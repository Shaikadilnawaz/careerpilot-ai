/**
 * Resume service — the ONLY module that talks to Firestore for resumes.
 *
 * 📌 Notice what this file NO LONGER does: touch storage at all.
 *
 * In Week 2 it owned both halves (Firebase Storage + Firestore). Vercel Blob's
 * only credential is a store-wide read-write token, which can never ship to the
 * browser — so uploads now go browser → Blob directly (authorized by a Route
 * Handler), and deletes go through a Server Action. What's left here is the
 * Firestore half, unchanged.
 *
 * That the Firestore code survived a complete storage-vendor swap untouched is
 * the clearest evidence the layering was worth it.
 */
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"

import { db, isFirebaseConfigured } from "@/lib/firebase/client"
import type { NewResume, Resume } from "../schema"

function assertConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Add your keys to .env.local.")
  }
}

/**
 * Pre-generate the resume's id and blob pathname in one place.
 *
 * We create the Firestore doc ref FIRST (without writing anything) just to grab
 * its auto-generated id, then reuse that same id in the blob pathname. The file
 * and its metadata share one id, so the pointer is predictable and the two
 * systems stay in lock-step.
 *
 * 📌 The `users/{uid}/` prefix is not decoration — the upload Route Handler
 * refuses to mint a token for any path that doesn't start with the VERIFIED
 * uid. The path is the ownership boundary.
 */
export function newResumeRef(uid: string): {
  resumeId: string
  blobPathname: string
} {
  assertConfigured()
  const resumeRef = doc(collection(db, "users", uid, "resumes"))
  return {
    resumeId: resumeRef.id,
    blobPathname: `users/${uid}/resumes/${resumeRef.id}.pdf`,
  }
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
