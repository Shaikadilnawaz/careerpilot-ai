/**
 * Resume service — the ONLY module that talks to Firebase Storage + Firestore
 * for resumes. Components call these functions instead of importing Firebase
 * directly, exactly like auth-service does for Auth. One place for the data
 * logic = one place to change it.
 */
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage"
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"

import { db, storage, isFirebaseConfigured } from "@/lib/firebase/client"
import type { NewResume, Resume } from "../schema"

function assertConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Add your keys to .env.local.")
  }
}

/**
 * Pre-generate the resume's id and Storage path in one place.
 *
 * We create the Firestore doc ref FIRST (without writing anything) just to grab
 * its auto-generated id, then reuse that same id for the Storage file name. That
 * way the file and its metadata share one id — the `storagePath` pointer is
 * predictable and the two systems stay in lock-step.
 */
export function newResumeRef(uid: string): {
  resumeId: string
  storagePath: string
} {
  assertConfigured()
  const resumeRef = doc(collection(db, "users", uid, "resumes"))
  return {
    resumeId: resumeRef.id,
    storagePath: `users/${uid}/resumes/${resumeRef.id}.pdf`,
  }
}

/**
 * Upload the PDF bytes to Cloud Storage, reporting progress along the way.
 *
 * `uploadBytesResumable` returns an UploadTask that emits "state_changed" events
 * — that's how we get a live percentage for the progress bar. We wrap the
 * event-based API in a Promise so callers can simply `await` it.
 */
export function uploadResumeFile(
  storagePath: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<string> {
  assertConfigured()
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, storagePath), file, {
      contentType: file.type,
    })
    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        )
        onProgress(percent)
      },
      (error) => reject(error),
      async () => {
        // Upload finished — hand back a URL the browser can preview/download.
        const downloadURL = await getDownloadURL(task.snapshot.ref)
        resolve(downloadURL)
      }
    )
  })
}

/**
 * Write the metadata document. serverTimestamp() lets FIRESTORE stamp the time
 * on its own clock, so it's consistent no matter what the user's device clock
 * says — and it's what we sort the list by.
 */
export async function saveResume(
  uid: string,
  resumeId: string,
  data: Omit<NewResume, "uploadedAt">
): Promise<void> {
  assertConfigured()
  await setDoc(doc(db, "users", uid, "resumes", resumeId), {
    ...data,
    uploadedAt: serverTimestamp(),
  })
}

/**
 * Live subscription to a user's resumes, newest first.
 *
 * onSnapshot is a real-time listener (same idea as onAuthStateChanged): the
 * callback fires immediately with current data AND again whenever anything
 * changes. Returns an unsubscribe function — the component MUST call it on
 * unmount to avoid a memory leak.
 */
export function subscribeToResumes(
  uid: string,
  onData: (resumes: Resume[]) => void,
  onError: (error: Error) => void
): () => void {
  if (!isFirebaseConfigured) {
    onData([])
    return () => {}
  }
  const resumesQuery = query(
    collection(db, "users", uid, "resumes"),
    orderBy("uploadedAt", "desc")
  )
  return onSnapshot(
    resumesQuery,
    (snapshot) => {
      const resumes = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Resume, "id">),
      }))
      onData(resumes)
    },
    onError
  )
}

/**
 * Delete a resume from BOTH systems. Forgetting either half leaves an orphan:
 * a metadata row pointing at a missing file, or a file no UI can reach. We
 * remove the Storage file first, then the Firestore doc — and if the file is
 * already gone we still clean up the metadata rather than getting stuck.
 */
export async function deleteResume(uid: string, resume: Resume): Promise<void> {
  assertConfigured()
  try {
    await deleteObject(ref(storage, resume.storagePath))
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== "storage/object-not-found") throw error
  }
  await deleteDoc(doc(db, "users", uid, "resumes", resume.id))
}
