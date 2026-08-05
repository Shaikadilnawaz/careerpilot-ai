"use server"

/**
 * Server Action — write a cover letter.
 *
 * Same four-step gate as every other action in this project:
 *   1. requireUser  → WHO are you?
 *   2. Zod          → is the input WELL-FORMED?
 *   3. Firestore    → do you OWN this resume?
 *   4. Gemini       → the work
 *
 * 📌 One extra check that the structured-output actions get for free: because
 * `generateText` returns an unvalidated string, we have to sanity-check the
 * result ourselves. `generateObject` would have thrown NoObjectGeneratedError
 * on garbage; here, garbage is just a shorter string. Losing the schema means
 * inheriting the validation job.
 */
import { ZodError } from "zod"

import { requireUser, AuthError } from "@/lib/auth/require-user"
import { getResumeForAnalysis } from "@/features/resumes/services/resume-admin-service"
import { runCoverLetter } from "../services/cover-letter-service"
import { coverLetterInputSchema } from "../schema"

const MIN_RESUME_CHARS = 200
/** Anything shorter than this isn't a letter, whatever the model thinks. */
const MIN_LETTER_CHARS = 200

export type CoverLetterResult =
  | { ok: true; text: string }
  | { ok: false; error: string }

export async function writeCoverLetter(input: {
  idToken: unknown
  resumeId: unknown
  jobDescription: unknown
  company: unknown
  role: unknown
}): Promise<CoverLetterResult> {
  try {
    const uid = await requireUser(input.idToken)

    const { resumeId, jobDescription, company, role } =
      coverLetterInputSchema.parse({
        resumeId: input.resumeId,
        jobDescription: input.jobDescription,
        company: input.company,
        role: input.role,
      })

    const resume = await getResumeForAnalysis(uid, resumeId)
    if (!resume) {
      return { ok: false, error: "That resume could not be found." }
    }

    if (resume.extractedText.trim().length < MIN_RESUME_CHARS) {
      return {
        ok: false,
        error:
          "We couldn't read enough text from this PDF to write a letter from it.",
      }
    }

    const { text, finishReason } = await runCoverLetter(
      resume.extractedText,
      jobDescription,
      company,
      role
    )

    /**
     * 📌 THE CHECK THAT WAS MISSING, AND THE BUG IT LET THROUGH.
     *
     * A letter came back cut off mid-sentence — "My background in Computer
     * Science, combined with" — and every guard below waved it through, because
     * a truncated letter is not an error. It is just a shorter string.
     *
     * `finishReason` is the only thing that tells them apart:
     *   "stop"   → the model finished what it wanted to say
     *   "length" → it ran out of budget mid-word
     *
     * This is the price of `generateText`. `generateObject` gets truncation
     * detection for free: a half-written JSON object fails to parse and throws
     * NoObjectGeneratedError. Free text has no such tell — so we check it
     * ourselves, and we check it FIRST, because a truncated letter can easily
     * be long enough to satisfy the length guard below.
     */
    if (finishReason === "length") {
      return {
        ok: false,
        error:
          "The letter got cut off before it finished. Please try again — if it keeps happening, shorten the job description.",
      }
    }

    if (text.length < MIN_LETTER_CHARS) {
      return {
        ok: false,
        error: "The AI returned an unusually short letter. Please try again.",
      }
    }

    return { ok: true, text }
  } catch (error) {
    console.error("writeCoverLetter failed:", error)

    if (error instanceof AuthError) return { ok: false, error: error.message }

    if (error instanceof ZodError) {
      return {
        ok: false,
        error: error.issues[0]?.message ?? "That request wasn't valid.",
      }
    }

    const message = error instanceof Error ? error.message : ""
    if (message.includes("429") || /quota|rate limit/i.test(message)) {
      return {
        ok: false,
        error: "Too many requests right now. Wait a moment and try again.",
      }
    }

    return { ok: false, error: "Something went wrong writing your cover letter." }
  }
}
