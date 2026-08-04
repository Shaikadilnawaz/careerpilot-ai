"use server"

/**
 * Server Action — rewrite a resume for one job.
 *
 * Structurally identical to Week 3's analyzeResume, and that's the point: once
 * you've built the pipeline once, the second AI feature is mostly schema and
 * prompt. Same fixed order, same reasons:
 *
 *   1. requireUser  → WHO are you?             (verified Firebase ID token)
 *   2. Zod          → is the input WELL-FORMED?
 *   3. Firestore    → do you OWN this resume?  (ownership is structural)
 *   4. Gemini       → the actual work
 *
 * Step 5 (persist) is absent on purpose — see tailor-service.ts.
 */
import { ZodError } from "zod"
import { NoObjectGeneratedError } from "ai"

import { requireUser, AuthError } from "@/lib/auth/require-user"
import { getResumeForAnalysis } from "@/features/resumes/services/resume-admin-service"
import { runTailor } from "../services/tailor-service"
import { tailorInputSchema, type TailoredResume } from "../schema"

const MIN_RESUME_CHARS = 200

export type TailorResumeResult =
  | { ok: true; resume: TailoredResume }
  | { ok: false; error: string }

export async function tailorResume(input: {
  idToken: unknown
  resumeId: unknown
  jobDescription: unknown
}): Promise<TailorResumeResult> {
  try {
    const uid = await requireUser(input.idToken)

    const { resumeId, jobDescription } = tailorInputSchema.parse({
      resumeId: input.resumeId,
      jobDescription: input.jobDescription,
    })

    // The client says WHICH resume; the verified uid decides WHOSE. We re-read
    // the text server-side rather than trusting anything the client sends.
    const resume = await getResumeForAnalysis(uid, resumeId)
    if (!resume) {
      return { ok: false, error: "That resume could not be found." }
    }

    if (resume.extractedText.trim().length < MIN_RESUME_CHARS) {
      return {
        ok: false,
        error:
          "We couldn't read enough text from this PDF to rewrite it. It may be a scanned image — try uploading a text-based PDF.",
      }
    }

    const { resume: tailored } = await runTailor(
      resume.extractedText,
      jobDescription
    )

    return { ok: true, resume: tailored }
  } catch (error) {
    console.error("tailorResume failed:", error)

    if (error instanceof AuthError) return { ok: false, error: error.message }

    if (error instanceof ZodError) {
      return {
        ok: false,
        error: error.issues[0]?.message ?? "That request wasn't valid.",
      }
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

    return { ok: false, error: "Something went wrong rewriting your resume." }
  }
}
