/**
 * Application service — the ONLY module that talks to Firestore for
 * applications.
 *
 * 📌 Why this is client-side while analyses are server-side.
 *
 * The analyzer HAD to live on the server: it uses a secret API key, it costs
 * real money per call, and letting the client write results would let anyone
 * forge a perfect score. None of that is true here. Applications are the user's
 * own notes, there's no secret involved, and your firestore.rules already grant
 * owner-only read/write on users/{uid}/applications/{id}.
 *
 * So the client SDK is the right tool: less code, no token plumbing, and
 * real-time sync for free. Reach for the server when you must, not by habit.
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore"

import { db, isFirebaseConfigured } from "@/lib/firebase/client"
import type { Application, ApplicationStatus, NewApplication } from "../schema"

function assertConfigured() {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Add your keys to .env.local.")
  }
}

function applicationsRef(uid: string) {
  return collection(db, "users", uid, "applications")
}

/**
 * Create an application.
 *
 * `addDoc` (Firestore generates the id) rather than `setDoc` (we supply one),
 * because unlike resumes there's no second system that needs to agree on the
 * id — nothing else is named after it.
 */
export async function createApplication(
  uid: string,
  data: Omit<NewApplication, "createdAt" | "updatedAt">
): Promise<string> {
  assertConfigured()
  const ref = await addDoc(applicationsRef(uid), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Patch specific fields. `updateDoc` merges — it does NOT replace the document
 * the way setDoc would, which would silently wipe every field you didn't send.
 */
export async function updateApplication(
  uid: string,
  applicationId: string,
  patch: Partial<Omit<Application, "id" | "createdAt">>
): Promise<void> {
  assertConfigured()
  await updateDoc(doc(db, "users", uid, "applications", applicationId), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

/** Moving a card through the pipeline is common enough to deserve its own call. */
export async function updateApplicationStatus(
  uid: string,
  applicationId: string,
  status: ApplicationStatus
): Promise<void> {
  return updateApplication(uid, applicationId, { status })
}

export async function deleteApplication(
  uid: string,
  applicationId: string
): Promise<void> {
  assertConfigured()
  await deleteDoc(doc(db, "users", uid, "applications", applicationId))
}

/**
 * Live subscription, newest first. Same listener discipline as resumes: returns
 * the unsubscribe function, and the caller MUST invoke it on unmount.
 *
 * 📌 Ordering by `updatedAt` rather than `createdAt` means an application you
 * just moved to "interviewing" jumps to the top — the list sorts itself by what
 * you're actively working on, which is what a tracker is for.
 */
export function subscribeToApplications(
  uid: string,
  onData: (applications: Application[]) => void,
  onError: (error: Error) => void
): () => void {
  if (!isFirebaseConfigured) {
    onData([])
    return () => {}
  }
  const applicationsQuery = query(
    applicationsRef(uid),
    orderBy("updatedAt", "desc")
  )
  return onSnapshot(
    applicationsQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Application, "id">),
        }))
      )
    },
    onError
  )
}
