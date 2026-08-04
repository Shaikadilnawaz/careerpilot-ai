# Week 2 Study Sheet — Resume Upload, Storage, and Server Actions

Everything I should be able to explain in an interview after Week 2.

## 1. The core concept — Storage vs Firestore (the "pointer pattern")

- Firebase gives you **two** databases: **Cloud Storage** (files/binary blobs) and **Firestore** (structured documents).
- Why the PDF bytes go in **Storage**: Firestore documents are capped at **1 MiB** (~1,048,576 bytes); databases are bad at holding binary.
- Why metadata goes in **Firestore**: it's what you actually **query, sort, list, and display** (fileName, size, date, status).
- The **pointer**: the Firestore doc holds a `storagePath` string field that addresses the file in Storage.
- Cost/speed reason: Firestore reads the **whole** document every time — a 3 MB PDF inside a doc would make listing 10 resumes pull 30 MB. Pointer pattern keeps list docs tiny.
- This is a **general** pattern (S3 + Postgres, Blob + Cosmos), not a Firebase quirk.
- The flow: read small Firestore doc → get `storagePath`/`downloadURL` → fetch the real file from Storage.

## 2. Firebase Cloud Storage SDK

- `ref(storage, path)` — a reference (pointer) to a location in the bucket; doesn't upload anything by itself.
- `uploadBytesResumable(ref, file, metadata)` — starts a resumable upload and returns an **UploadTask**.
- Why "resumable": it emits progress events, so we can show a **% progress bar**.
- `task.on("state_changed", onProgress, onError, onComplete)` — an **event-based** API (3 callbacks).
- `snapshot.bytesTransferred / snapshot.totalBytes` — how you compute the upload percentage.
- Wrapping the event API in a `new Promise(...)` so callers can `await` it (event API → Promise adapter pattern).
- `getDownloadURL(ref)` — returns a long-lived URL the browser can use to preview/download the file.
- `deleteObject(ref)` — removes the file from Storage.
- Handling `storage/object-not-found` on delete so a missing file doesn't block cleanup.
- Why the Storage bucket ends in `.firebasestorage.app` (the newer default bucket domain).

## 3. Firestore — writing and reading

- **Subcollections**: `users/{uid}/resumes/{resumeId}` — a collection nested under a document.
- `collection(db, "users", uid, "resumes")` — reference to a (sub)collection.
- `doc(collectionRef)` — creates a ref with an **auto-generated id WITHOUT writing** (used to reserve an id up front).
- Why pre-generate the id: so the Storage file name and the Firestore doc **share one id** and stay in lock-step.
- `setDoc(docRef, data)` vs `addDoc(collectionRef, data)` — `setDoc` writes to a specific id; `addDoc` generates one for you.
- `deleteDoc(docRef)` — removes a document.
- `serverTimestamp()` — Firestore stamps the time on **its own clock**, not the user's device clock; consistent and used for sorting.
- `query(collectionRef, orderBy("uploadedAt", "desc"))` — build a sorted query.
- `onSnapshot(query, onData, onError)` — a **real-time listener**: fires immediately with current data and again on every change. Returns an **unsubscribe** function.
- `snapshot.docs.map(d => ({ id: d.id, ...d.data() }))` — turning a snapshot into typed objects.
- Same mental model as `onAuthStateChanged`: subscribe once, clean up on unmount.

## 4. Server Actions (first real use — deep dive in Week 3)

- `"use server"` at the **top of a file** marks **every export** as a Server Function.
- A Server Function runs **on the server** and is **callable from the browser**; the call becomes a **POST** request.
- The browser never receives this code or its dependencies (e.g. `unpdf`) — keeps the client bundle small.
- Must be **async** (it's a network round-trip under the hood).
- `FormData` is how the browser cheaply ships a binary `File` to a Server Action without hand-writing serialization.
- ⚠️ **Security**: Server Functions are reachable by **direct POST**, not just via your UI — you must verify auth/authorization inside them (we defer that to Week 3's Admin SDK).
- Next 16 extras seen in the docs: `refresh()` from `next/cache`, `revalidatePath`, `redirect` (control-flow throw).

## 5. PDF text extraction

- Extraction runs **server-side** because PDF parsing needs Node libraries that shouldn't/can't run in the browser.
- Library = **`unpdf`** (built for Next.js/serverless), NOT `pdf-parse` (which crashes on import in bundled envs by trying to read a test file).
- `File.arrayBuffer()` → `new Uint8Array(buffer)` — the byte format the parser expects.
- `getDocumentProxy(uint8array)` then `extractText(pdf, { mergePages: true })` → one merged text string + `totalPages`.
- Scanned/image-only PDFs return **no text** → we flag them with a `"no_text"` status (image PDFs need OCR, which we don't do).
- **Tradeoff we made**: the file is uploaded twice (once to Storage from the browser, once to the Server Action to extract). In Week 3 the Admin SDK can pull the file straight from Storage instead.

## 6. Web platform / browser File APIs

- The `File` object (a browser Web API): `.name`, `.size`, `.type`, `.arrayBuffer()`.
- Hidden `<input type="file" accept="application/pdf">` + a `<label htmlFor>` as the click target.
- Resetting `input.value = ""` after upload so the **same file** can be picked again (change event won't fire otherwise).
- **Drag & drop**: `onDragOver` (must `preventDefault` to allow a drop), `onDragLeave`, `onDrop`.
- `event.dataTransfer.files` — how you read dropped files.
- `FormData` + `formData.append("file", file)` — packaging a file for a request.

## 7. React patterns used

- `useRef` on the file input to imperatively clear it.
- A **phase** state machine (`"idle" | "uploading" | "processing"`) instead of multiple booleans.
- `useEffect` to subscribe to `onSnapshot`, returning the **unsubscribe** for cleanup (prevents memory leaks + duplicate listeners).
- The **`null` vs `[]` loading pattern**: `null` = still loading first snapshot, `[]` = loaded but genuinely empty (drives skeleton vs empty-state).
- **Two-click delete confirm** via local `confirming` state — safer than a one-click destructive action.
- Lifting the whole upload orchestration into one client component; the list updates itself (no shared state needed).

## 8. Security rules (the REAL access control)

- Client SDK code is **convenience, not security** — rules run on Google's servers and can't be bypassed.
- Firestore rule: `allow read, write: if request.auth != null && request.auth.uid == userId` — owner-only under `users/{uid}/**`.
- `{document=**}` — recursive wildcard matching a document and everything beneath it.
- Storage rule mirrors it, PLUS validates the **incoming** file: `request.resource.size`, `request.resource.contentType`.
- `request.auth` = the verified signed-in user; `request.resource` = the file/data being written.
- `write` covers create + update; `delete` is a separate permission.
- Why validate size/type in rules even though the client already does: a tampered client could skip the client check — the rule can't be skipped.

## 9. Architecture & patterns (continued from Week 1)

- **Service layer**: `resume-service.ts` is the ONLY module importing `firebase/storage` + Firestore for resumes (mirrors `auth-service.ts`).
- **Feature folder**: everything resume-related lives under `src/features/resumes/` (schema, services, actions, components, format helpers).
- **Provider-agnostic**: Firebase stays a swappable detail hidden behind the service.
- **Orphan prevention**: delete must remove from **both** systems (Storage file + Firestore doc), or you leave a dangling pointer or an unreachable file.
- **Id pre-generation** ties the two systems together with one shared id.
- **Zod file validation**: `z.instanceof(File)` + `.refine()` for type/size — same "schema is the source of truth" idea as auth, validated before wasting an upload.

## 10. Specific things we built

- `ResumeUploader` — drag & drop + click upload, phase-based progress UI, orchestrates validate → upload → extract → save.
- `ResumeList` — real-time list via `onSnapshot`, skeleton loading, empty state.
- `ResumeCard` — metadata row with a "No text" badge, Preview (opens the PDF), and two-click Delete.
- `extract-text.ts` — the Server Action that turns an uploaded PDF into plain text.
- `resume-service.ts` — Storage upload w/ progress, Firestore CRUD, live subscription, dual-system delete.
- `schema.ts` / `format.ts` — validation + the `Resume` type + byte/date formatting.
- `firestore.rules` + `storage.rules` — owner-only access + upload validation.

## Interview one-liners to memorize

- **"Why Storage for the file but Firestore for the metadata?"** → 1 MiB doc cap + you only ever query the metadata; the doc holds a `storagePath` pointer to the file.
- **"What's a Server Action?"** → an async server function callable from the browser via a POST; code + deps never ship to the client; must verify auth because it's reachable by direct POST.
- **"Where's your real security?"** → in Firestore/Storage **rules**, keyed on `request.auth.uid`; the client code can't be trusted.
- **"How does the list stay up to date?"** → `onSnapshot` real-time listener, unsubscribed on unmount.

## Outstanding / next

- ⚠️ Deploy the rules: paste `firestore.rules` and `storage.rules` into the Firebase Console (Firestore → Rules, Storage → Rules) and Publish. Until then, uploads may be denied or wide open depending on your project defaults.
- ⚠️ Still need to **rotate the Firebase Admin private key** before Week 3 (regenerate + delete old key + wrap in quotes in `.env.local`).
- Week 3: the AI ATS analyzer — Server Actions + Vercel AI SDK `generateObject` + Zod, using the `extractedText` we now store.
