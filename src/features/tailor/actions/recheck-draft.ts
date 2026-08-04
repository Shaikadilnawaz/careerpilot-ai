"use server"

/**
 * Server Action — re-score a tailored draft the user is currently editing.
 *
 * 📌 THIS ONE DELIBERATELY BREAKS THE WEEK 3 RULE, AND YOU SHOULD KNOW WHY.
 *
 * Every other action takes a REFERENCE (a resumeId) and re-reads the content
 * from Firestore, because the client must not be able to hand us content and
 * have us treat it as belonging to a record they may not own.
 *
 * Here there is nothing to re-read. The draft exists only in the user's browser
 * — it was never persisted (see tailor-service.ts). There is no record, so
 * there is no ownership question: the user is scoring their own unsaved text.
 *
 * But the OTHER reason for that rule still applies: unbounded client input means
 * unbounded input tokens, which means someone can run up the bill. So we keep
 * the protection that still matters:
 *   - the draft must satisfy the full Zod schema (shape is constrained)
 *   - the flattened text is hard-capped before it reaches the model
 *   - the caller must still be a verified, signed-in user
 *
 * The lesson: don't cargo-cult a rule. Understand which of its reasons apply.
 */
import { ZodError } from "zod"
import { NoObjectGeneratedError } from "ai"

import { requireUser, AuthError } from "@/lib/auth/require-user"
import { runAnalysis } from "@/features/analysis/services/analysis-service"
import type { AnalysisResult } from "@/features/analysis/schema"

import { tailoredResumeSchema, MAX_TAILOR_JD_CHARS } from "../schema"
import { tailoredResumeToText } from "../to-text"

/** Hard ceiling on what we'll send to the model, regardless of shape. */
const MAX_DRAFT_CHARS = 20_000

export type RecheckResult =
  | { ok: true; result: AnalysisResult }
  | { ok: false; error: string }

export async function recheckDraft(input: {
  idToken: unknown
  draft: unknown
  jobDescription?: unknown
}): Promise<RecheckResult> {
  try {
    await requireUser(input.idToken)

    // Validating against the full schema means a caller can't send 4 MB of
    // arbitrary junk — it has to look exactly like a resume.
    const draft = tailoredResumeSchema.parse(input.draft)

    const text = tailoredResumeToText(draft)
    if (text.length > MAX_DRAFT_CHARS) {
      return { ok: false, error: "That draft is too long to check." }
    }

    const jobDescription =
      typeof input.jobDescription === "string" &&
      input.jobDescription.trim().length > 0
        ? input.jobDescription.trim().slice(0, MAX_TAILOR_JD_CHARS)
        : undefined

    // Nothing is persisted. This is a check, not a record — so there's no new
    // Firestore collection and no security-rules change needed.
    const { result } = await runAnalysis(text, jobDescription)

    return { ok: true, result }
  } catch (error) {
    console.error("recheckDraft failed:", error)

    if (error instanceof AuthError) return { ok: false, error: error.message }

    if (error instanceof ZodError) {
      return { ok: false, error: "That draft wasn't valid." }
    }

    if (NoObjectGeneratedError.isInstance(error)) {
      return {
        ok: false,
        error: "The AI returned an unexpected response. Please try again.",
      }
    }

    const message = error instanceof Error ? error.message : ""
    if (message.includes("429") || /quota|rate limit/i.test(message)) {
      return {
        ok: false,
        error: "Too many requests right now. Wait a moment and try again.",
      }
    }

    return { ok: false, error: "Could not re-check this draft." }
  }
}
