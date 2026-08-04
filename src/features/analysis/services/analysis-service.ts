/**
 * Analysis service — the AI call and the ONLY module that writes
 * users/{uid}/analyses.
 *
 * Division of labour with the Server Action that calls this:
 *   action  → who are you, is your input valid, what error should the UI show
 *   service → talk to the model, talk to the database
 * Keeping them apart means you can change providers or storage without touching
 * the auth/validation logic, and you can read either one without holding the
 * other in your head.
 */
import "server-only"
import { generateObject } from "ai"
import { FieldValue } from "firebase-admin/firestore"

import { aiModel } from "@/lib/ai/client"
import { adminDb } from "@/lib/firebase/admin"
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "../prompts"
import {
  atsAnalysisSchema,
  atsWithJobMatchSchema,
  type AnalysisResult,
  type NewAnalysis,
} from "../schema"

/** The model identifier we stamp on every stored result. */
export const ANALYSIS_MODEL = "gemini-3.6-flash"

export interface AnalysisRun {
  result: AnalysisResult
  usage: { inputTokens: number; outputTokens: number }
}

/**
 * Calls Gemini and returns a validated, fully typed analysis.
 *
 * 📌 THE SCHEMA IS CHOSEN AT CALL TIME, not made optional.
 * With a job description we pass `atsWithJobMatchSchema`; without one,
 * `atsAnalysisSchema`. Both are the same base schema, one `.extend()`ed. This
 * beats a single schema with `jobMatch: ...optional()` for two reasons: Gemini's
 * structured-output support for optional nested objects is unreliable, and a
 * REQUIRED field is a far stronger instruction to the model than an optional one
 * ("you must fill this in" vs "fill this in if you feel like it").
 *
 * 📌 temperature 0.2 — low, because this is a SCORING feature and users expect
 * roughly the same resume to get roughly the same score twice. It never becomes
 * truly deterministic: LLMs are non-deterministic even at temperature 0, so
 * expect a few points of drift between runs. Week 4's cover-letter generation
 * will use a much higher temperature, because there we want variety.
 */
export async function runAnalysis(
  resumeText: string,
  jobDescription?: string
): Promise<AnalysisRun> {
  const shared = {
    model: aiModel,
    system: ANALYSIS_SYSTEM_PROMPT,
    prompt: buildAnalysisPrompt(resumeText, jobDescription),
    temperature: 0.2,
    // Caps the RESPONSE, not the input. Set generously: if the model runs out
    // of room mid-JSON you don't get a partial object, you get a thrown error.
    // 📌 In AI SDK v5+ this option was renamed from `maxTokens` — nearly every
    // tutorial online still shows the old name.
    maxOutputTokens: 4096,
  }

  const { object, usage } = jobDescription
    ? await generateObject({ ...shared, schema: atsWithJobMatchSchema })
    : await generateObject({ ...shared, schema: atsAnalysisSchema })

  return {
    result: object,
    usage: {
      // Usage fields are optional in the SDK's type — a provider may not report
      // them. Default to 0 rather than writing `undefined`, which Firestore
      // rejects outright.
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  }
}

/**
 * Persists one analysis and returns its new id.
 *
 * `createdAt` is set with `FieldValue.serverTimestamp()` — Google's clock, not
 * the caller's. A timestamp sent from a device is whatever that device's clock
 * says, which for ordering a history list is worthless.
 */
export async function saveAnalysis(
  uid: string,
  data: Omit<NewAnalysis, "createdAt">
): Promise<string> {
  const ref = await adminDb
    .collection("users")
    .doc(uid)
    .collection("analyses")
    .add({ ...data, createdAt: FieldValue.serverTimestamp() })

  return ref.id
}
