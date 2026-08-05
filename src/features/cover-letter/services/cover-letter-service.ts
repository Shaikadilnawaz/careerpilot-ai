/**
 * Cover letter service — the AI call.
 *
 * 📌 `generateText`, not `generateObject`. The return value is `text` (a plain
 * string) instead of `object`. There's no schema to convert to JSON Schema, no
 * structured-output mode, no re-validation — because there's no structure to
 * validate. That also means one Week 3 safety net is missing: a malformed
 * response can't be caught by a schema, so the caller must treat an empty or
 * absurd string as a failure itself.
 */
import "server-only"
import { generateText } from "ai"

import { aiModel } from "@/lib/ai/client"
import {
  COVER_LETTER_SYSTEM_PROMPT,
  buildCoverLetterPrompt,
} from "../prompts"

export const COVER_LETTER_MODEL = "gemini-3.6-flash"

export interface CoverLetterRun {
  text: string
  usage: { inputTokens: number; outputTokens: number }
}

/**
 * 📌 temperature 0.7 — the highest in this project, and the third distinct
 * value we've used:
 *   0.2  analysis   → a score must be stable run to run
 *   0.4  tailoring  → freedom to rephrase, anchored to facts
 *   0.7  this       → variety is the POINT; two applications should not
 *                     receive the same letter with the company name swapped
 *
 * Temperature is a per-feature decision. Being able to explain why each number
 * differs is worth more in an interview than knowing what the parameter does.
 */
export async function runCoverLetter(
  resumeText: string,
  jobDescription: string,
  company: string,
  role: string
): Promise<CoverLetterRun> {
  const { text, usage } = await generateText({
    model: aiModel,
    system: COVER_LETTER_SYSTEM_PROMPT,
    prompt: buildCoverLetterPrompt(resumeText, jobDescription, company, role),
    temperature: 0.7,
    // A letter is short. Capping low also discourages rambling — the model
    // tends to fill the space it's given.
    maxOutputTokens: 1200,
  })

  return {
    text: text.trim(),
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  }
}
