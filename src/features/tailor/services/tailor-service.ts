/**
 * Tailor service — the AI call that rewrites a resume for one job.
 *
 * Same division of labour as Week 3:
 *   action  → who are you, is your input valid, what error should the UI show
 *   service → talk to the model
 *
 * 📌 Note what this service does NOT do: write to a database. Week 3's analysis
 * service persisted its result; this one just returns it. That's a deliberate
 * scope cut — a tailored resume's real deliverable is the downloaded PDF, and
 * persisting it would need a new Firestore collection plus a rules change and
 * redeploy. We can add history later without touching this file.
 */
import "server-only"
import { generateObject } from "ai"

import { aiModel } from "@/lib/ai/client"
import { TAILOR_SYSTEM_PROMPT, buildTailorPrompt } from "../prompts"
import { tailoredResumeSchema, type TailoredResume } from "../schema"

export const TAILOR_MODEL = "gemini-3.6-flash"

export interface TailorRun {
  resume: TailoredResume
  usage: { inputTokens: number; outputTokens: number }
}

/**
 * Rewrites a resume against a job description and returns validated data.
 *
 * 📌 temperature 0.4 — deliberately between Week 3's 0.2 and the ~0.7 a cover
 * letter will want. Rewriting bullets needs enough freedom to phrase things
 * well, but it must stay anchored to facts. Temperature is a per-feature
 * decision, not a global setting.
 *
 * 📌 maxOutputTokens is much higher than the analyser's 4096 because a full
 * resume is a far bigger payload than a score plus some notes. Undersize this
 * and the model runs out of room mid-JSON — which doesn't give you a partial
 * object, it throws.
 */
export async function runTailor(
  resumeText: string,
  jobDescription: string
): Promise<TailorRun> {
  const { object, usage } = await generateObject({
    model: aiModel,
    system: TAILOR_SYSTEM_PROMPT,
    prompt: buildTailorPrompt(resumeText, jobDescription),
    schema: tailoredResumeSchema,
    temperature: 0.4,
    maxOutputTokens: 8192,
  })

  return {
    resume: object,
    usage: {
      // usage fields are optional in the SDK's types — default them so a
      // missing value can never surface as `undefined` downstream.
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  }
}
