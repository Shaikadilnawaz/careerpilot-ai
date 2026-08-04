"use server"

/**
 * THE SERVER ACTION — the centrepiece of Week 3.
 *
 * `"use server"` does not mean "this runs on the server". It means "generate a
 * public HTTP endpoint for this function". At build time the compiler replaces
 * the body in the client bundle with an encrypted action id; calling it POSTs
 * that id plus the arguments back to the server.
 *
 * The consequence is the whole reason this file is shaped the way it is:
 * ANYONE WHO CAN READ YOUR JS BUNDLE CAN CALL THIS WITH ANY ARGUMENTS, from
 * curl, with no browser involved. The analyse button only rendering on a
 * protected page is a UI detail, not a security boundary. Next.js gives us a
 * CSRF check and a 1MB body cap; authentication, authorisation, validation and
 * rate limiting are entirely ours.
 *
 * Hence the fixed order below, where every step can reject for its own reason:
 *
 *   1. requireUser  → WHO are you?          (verified Firebase ID token)
 *   2. Zod          → is the input WELL-FORMED?
 *   3. Firestore    → do you OWN this resume? (ownership is structural: the
 *                     verified uid is part of the document path)
 *   4. Gemini       → the actual work
 *   5. Firestore    → persist
 *
 * Steps 1-3 are not ceremony. Skip 1 and anyone analyses anything; skip 3 and a
 * valid user reads other people's resumes by guessing ids.
 */
import { ZodError } from "zod"
import { NoObjectGeneratedError } from "ai"

import { requireUser, AuthError } from "@/lib/auth/require-user"
import { getResumeForAnalysis } from "@/features/resumes/services/resume-admin-service"
import {
  runAnalysis,
  saveAnalysis,
  ANALYSIS_MODEL,
} from "../services/analysis-service"
import { analyzeInputSchema, type AnalysisResult } from "../schema"

/** Below this, there isn't enough text to say anything useful about. */
const MIN_RESUME_CHARS = 200

/**
 * A discriminated union instead of throwing.
 *
 * 📌 Server Action return values are serialised to the client, and an uncaught
 * throw in production reaches the browser as a generic "An error occurred in the
 * Server Components render" with the real message stripped — useless to the
 * user. Returning `{ ok: false, error }` lets us control exactly what the UI
 * says. The flip side of the same coin: never put raw exception text in here,
 * because whatever we return IS public.
 */
export type AnalyzeResumeResult =
  | { ok: true; analysisId: string; result: AnalysisResult }
  | { ok: false; error: string }

/**
 * Arguments arrive as `unknown` on purpose. TypeScript's guarantees stop at the
 * network boundary — this is a public endpoint, and the caller may send
 * anything at all.
 */
export async function analyzeResume(input: {
  idToken: unknown
  resumeId: unknown
  jobDescription?: unknown
}): Promise<AnalyzeResumeResult> {
  try {
    // 1. WHO — throws AuthError if the token is missing, forged, expired or revoked.
    const uid = await requireUser(input.idToken)

    // 2. WELL-FORMED — shape only. Zod cannot tell us this resume is *ours*;
    //    a perfectly valid id can still point at someone else's document.
    const { resumeId, jobDescription } = analyzeInputSchema.parse({
      resumeId: input.resumeId,
      jobDescription: input.jobDescription,
    })

    // 3. OWNERSHIP — the client told us WHICH resume; the verified uid decides
    //    WHOSE. We re-read the text from Firestore rather than trusting any text
    //    the client might have sent, which also keeps input tokens bounded.
    const resume = await getResumeForAnalysis(uid, resumeId)
    if (!resume) {
      // Deliberately identical to a "not found": never confirm that a document
      // exists but belongs to someone else.
      return { ok: false, error: "That resume could not be found." }
    }

    if (resume.extractedText.trim().length < MIN_RESUME_CHARS) {
      // The "no_text" case from Week 2 — a scanned/image-only PDF. Sending an
      // empty string to the model would burn a call to be told nothing.
      return {
        ok: false,
        error:
          "We couldn't read enough text from this PDF to analyse it. It may be a scanned image — try uploading a text-based PDF.",
      }
    }

    // 4. THE WORK.
    const { result, usage } = await runAnalysis(
      resume.extractedText,
      jobDescription
    )

    // 5. PERSIST. Note the token counts: logged from day one, because that
    //    number is what LLM cost is actually made of.
    const analysisId = await saveAnalysis(uid, {
      resumeId,
      resumeFileName: resume.fileName,
      jobDescription: jobDescription ?? "",
      hasJobDescription: Boolean(jobDescription),
      result,
      model: ANALYSIS_MODEL,
      usage,
    })

    return { ok: true, analysisId, result }
  } catch (error) {
    // Log the real error server-side; return something safe to the client.
    console.error("analyzeResume failed:", error)

    if (error instanceof AuthError) {
      return { ok: false, error: error.message }
    }

    if (error instanceof ZodError) {
      return {
        ok: false,
        error: error.issues[0]?.message ?? "That request wasn't valid.",
      }
    }

    // The model returned something that didn't satisfy the schema, or ran out
    // of output tokens mid-JSON. Retrying often just works.
    if (NoObjectGeneratedError.isInstance(error)) {
      return {
        ok: false,
        error: "The AI returned an unexpected response. Please try again.",
      }
    }

    // Gemini's free tier is rate limited per minute; two fast clicks can hit it.
    const message = error instanceof Error ? error.message : ""
    if (message.includes("429") || /quota|rate limit/i.test(message)) {
      return {
        ok: false,
        error: "Too many requests right now. Wait a moment and try again.",
      }
    }

    return { ok: false, error: "Something went wrong analysing your resume." }
  }
}
