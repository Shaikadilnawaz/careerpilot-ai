/**
 * Resume reads from the SERVER (Admin SDK).
 *
 * WHY THIS IS A SEPARATE FILE FROM resume-service.ts
 * `resume-service.ts` uses the Firebase CLIENT SDK: it runs in the browser, and
 * every read it makes is checked against your security rules. This file uses the
 * ADMIN SDK: it runs on the server and BYPASSES those rules completely.
 *
 * Two different SDKs, two different trust levels, two different files. Mixing
 * them in one module is how people accidentally import `firebase-admin` into a
 * Client Component and leak a service-account key into the browser bundle. The
 * `server-only` import below turns that mistake into a build error.
 */
import "server-only"
import { adminDb } from "@/lib/firebase/admin"

/** The slice of a resume the analyser actually needs. */
export interface ResumeForAnalysis {
  fileName: string
  extractedText: string
}

/**
 * Loads a resume, enforcing ownership by CONSTRUCTION.
 *
 * 📌 Note the path: users/{uid}/resumes/{resumeId}, where `uid` came from a
 * verified ID token and `resumeId` came from the client. Because the owner's uid
 * is part of the path, asking for someone else's resume simply reads a document
 * that doesn't exist — there is no "check the ownerId field and hope we
 * remembered to" step to forget. Making authorisation structural rather than
 * conditional is why the whole schema is nested under users/{uid}.
 *
 * Returns null when the document is missing OR belongs to someone else. The
 * caller cannot distinguish the two cases, and shouldn't: telling an attacker
 * "that resume exists, just not yours" leaks information for free.
 */
export async function getResumeForAnalysis(
  uid: string,
  resumeId: string
): Promise<ResumeForAnalysis | null> {
  const snap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("resumes")
    .doc(resumeId)
    .get()

  if (!snap.exists) return null

  const data = snap.data()
  if (!data) return null

  return {
    fileName: typeof data.fileName === "string" ? data.fileName : "resume.pdf",
    extractedText:
      typeof data.extractedText === "string" ? data.extractedText : "",
  }
}
