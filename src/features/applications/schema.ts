import { z } from "zod"
import type { Timestamp } from "firebase/firestore"

/**
 * Applications domain — the tracker.
 *
 * This is the HUB of the app. Resumes and analyses are artifacts that float
 * free until an application binds them to a real job. That's why an application
 * document carries references to both.
 */

/**
 * The pipeline. Order matters — it's the order we render columns/groups in, so
 * defining it once as a const array keeps the UI and the type in sync.
 *
 * 📌 `as const` makes TypeScript infer the literal union `"saved" | "applied" |
 * …` instead of the useless `string[]`. That's what lets us derive the Zod enum
 * AND the TS type from this single array — the same "one source of truth" move
 * we use everywhere else.
 */
export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** Human labels, kept beside the values so a rename can't miss one. */
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
}

/**
 * What the form accepts. Note the deliberate looseness: only company and role
 * are required. A tracker you have to fill in completely is a tracker nobody
 * uses — the point is to capture a job in five seconds, then enrich it later.
 */
export const applicationInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(120),
  role: z.string().trim().min(1, "Role is required.").max(160),
  /**
   * `z.union([url, literal("")])` rather than `.url().optional()` because an
   * empty text input produces "" — not undefined — and "" fails `.url()`. This
   * is the single most common Zod gotcha with optional URL fields.
   */
  jobUrl: z
    .union([z.string().trim().url("Enter a valid URL."), z.literal("")])
    .optional(),
  status: z.enum(APPLICATION_STATUSES),
  /** Optional link to a resume — enables "which resume did I send?" */
  resumeId: z.string().optional(),
  /** Kept so Week 4's tailoring can reuse it without re-pasting. */
  jobDescription: z.string().trim().max(12_000).optional(),
  notes: z.string().trim().max(2_000).optional(),
})

export type ApplicationInput = z.infer<typeof applicationInputSchema>

/**
 * The Firestore document at users/{uid}/applications/{id}.
 */
export interface Application {
  id: string
  company: string
  role: string
  jobUrl: string
  status: ApplicationStatus
  /** Which resume was sent. Empty string when not linked yet. */
  resumeId: string
  /**
   * 📌 Denormalised on purpose. Without it, rendering a list of 20 applications
   * would mean 20 extra Firestore reads just to show filenames. Storing a copy
   * trades a little duplication for a lot of speed — the standard NoSQL
   * bargain. The cost: if the resume is renamed, this goes stale.
   */
  resumeFileName: string
  /** Links to a Week 3 analysis, so a score can be shown inline later. */
  analysisId: string
  jobDescription: string
  notes: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** What we write on create — everything except the generated id. */
export type NewApplication = Omit<Application, "id">
