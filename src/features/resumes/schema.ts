import { z } from "zod"
import type { Timestamp } from "firebase/firestore"

/**
 * Resume domain: validation rules + the shape of our data.
 *
 * Same philosophy as the auth schema — Zod is the single source of truth for
 * "what counts as a valid upload", and we reuse it on the client (instant
 * rejection before we waste an upload) and could reuse it on the server too.
 */

// One place to change these limits later.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024 // 5 MB
export const ACCEPTED_RESUME_TYPE = "application/pdf"

/**
 * Validates a browser File before we upload it. `z.instanceof(File)` only exists
 * in the browser (File is a Web API), so this schema is for CLIENT-side use.
 */
export const resumeFileSchema = z
  .instanceof(File, { message: "Please choose a file." })
  .refine((file) => file.type === ACCEPTED_RESUME_TYPE, {
    message: "Only PDF files are supported.",
  })
  .refine((file) => file.size > 0, {
    message: "That file appears to be empty.",
  })
  .refine((file) => file.size <= MAX_RESUME_BYTES, {
    message: "File is too large. Maximum size is 5 MB.",
  })

/**
 * Lifecycle of a resume:
 *  - "ready"    → uploaded, text extracted, good to go
 *  - "no_text"  → uploaded but we couldn't pull any text (e.g. a scanned image PDF)
 * (Week 3 will add "analyzing" | "analyzed" for the AI pass.)
 */
export type ResumeStatus = "ready" | "no_text"

/**
 * The Firestore metadata document at users/{uid}/resumes/{id}.
 * Note what is here vs. NOT here: the PDF bytes live in Storage; this doc only
 * holds the small, queryable facts + the `storagePath` POINTER to the file.
 */
export interface Resume {
  id: string
  fileName: string
  sizeBytes: number
  contentType: string
  /**
   * The pointer: where the real file lives inside the blob store.
   *
   * 📌 The pointer pattern from Week 2 is unchanged — Firestore still holds
   * small queryable metadata plus an address for the binary. Only the
   * DESTINATION moved (Firebase Storage → Vercel Blob). Swapping a vendor
   * without changing the architecture is the whole point of having a boundary.
   */
  blobPathname: string
  /**
   * The blob's canonical URL. NOT directly viewable — the store is private, so
   * fetching this without credentials returns 403. It's what we pass to the
   * delete API, and what we sign on demand to produce a preview link.
   *
   * 📌 Contrast with Week 2's `downloadURL`, which was a long-lived public URL:
   * anyone it was forwarded to could read the resume forever. Resumes are PII,
   * so we now mint a 5-minute signed URL per request instead of storing one.
   */
  blobUrl: string
  /** Extracted plain text — feeds Week 3's AI analyzer. */
  extractedText: string
  status: ResumeStatus
  /** serverTimestamp() — null for the brief moment before the server resolves it. */
  uploadedAt: Timestamp | null
}

/** What the upload step writes to Firestore (everything except the generated id). */
export type NewResume = Omit<Resume, "id">
