"use server"

/**
 * Server Actions for operations that need the blob token.
 *
 * WHY THESE MOVED TO THE SERVER
 * In Week 2 the browser deleted files directly, because the Firebase Storage
 * client SDK authenticates as the signed-in user and Storage rules enforced
 * ownership. Vercel Blob has no per-user client SDK: the only credential is a
 * store-wide read-write token. Shipping that to the browser would let any user
 * read and delete every user's files.
 *
 * So the trust model shifts to the one we already use for analyses: the server
 * holds the credential, verifies who is asking, checks ownership itself, and
 * performs the operation on the caller's behalf.
 */
import { requireUser, AuthError } from "@/lib/auth/require-user"
import { createPreviewUrl, deleteBlob } from "@/lib/blob/client"
import { adminDb } from "@/lib/firebase/admin"

export type PreviewResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export type DeleteResult = { ok: true } | { ok: false; error: string }

/**
 * Read the caller's own resume document.
 *
 * Ownership is enforced BY THE PATH: we look under the verified uid, so asking
 * for someone else's resume id simply reads a document that does not exist.
 * There is no `ownerId` field to remember to check — and therefore none to
 * forget. Returns null for both "missing" and "not yours", so we never confirm
 * that a document exists but belongs to somebody else.
 */
async function getOwnedResume(uid: string, resumeId: string) {
  const snap = await adminDb
    .doc(`users/${uid}/resumes/${resumeId}`)
    .get()
  return snap.exists ? { id: snap.id, ...snap.data() } : null
}

/**
 * Mint a short-lived signed URL so the owner can view their own PDF.
 */
export async function getResumePreviewUrl(input: {
  idToken: unknown
  resumeId: unknown
}): Promise<PreviewResult> {
  try {
    const uid = await requireUser(input.idToken)

    if (typeof input.resumeId !== "string" || !input.resumeId) {
      return { ok: false, error: "Missing resume id." }
    }

    const resume = await getOwnedResume(uid, input.resumeId)
    if (!resume) {
      return { ok: false, error: "Resume not found." }
    }

    const pathname = (resume as { blobPathname?: string }).blobPathname
    if (!pathname) {
      return { ok: false, error: "This resume has no file attached." }
    }

    return { ok: true, url: await createPreviewUrl(pathname) }
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message }
    console.error("Preview URL generation failed:", error)
    return { ok: false, error: "Could not open this resume." }
  }
}

/**
 * Delete a resume from BOTH systems.
 *
 * Order matters: blob first, then the metadata document. If the blob delete
 * fails we stop and keep the row, so the file stays reachable and the user can
 * retry. Deleting the row first would orphan the file forever — nothing would
 * be left pointing at it, and it would silently consume your storage quota.
 */
export async function deleteResumeAction(input: {
  idToken: unknown
  resumeId: unknown
}): Promise<DeleteResult> {
  try {
    const uid = await requireUser(input.idToken)

    if (typeof input.resumeId !== "string" || !input.resumeId) {
      return { ok: false, error: "Missing resume id." }
    }

    const resume = await getOwnedResume(uid, input.resumeId)
    if (!resume) {
      return { ok: false, error: "Resume not found." }
    }

    const blobUrl = (resume as { blobUrl?: string }).blobUrl
    if (blobUrl) {
      await deleteBlob(blobUrl)
    }

    await adminDb.doc(`users/${uid}/resumes/${input.resumeId}`).delete()

    return { ok: true }
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message }
    console.error("Resume delete failed:", error)
    return { ok: false, error: "Could not delete this resume." }
  }
}
