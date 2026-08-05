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
  /**
   * Why the model stopped. "stop" = it finished the letter. "length" = it hit
   * the token ceiling mid-word. The caller MUST check this — see below.
   */
  finishReason: string
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number }
}

/**
 * 📌 THE NUMBER THAT BIT US. This is NOT "how long may the letter be".
 *
 * Gemini 3.x is a THINKING model: it reasons before it answers, and those
 * reasoning tokens are spent from this same budget. A measured run:
 *
 *     outputTokens 1173  =  textTokens 271  +  reasoningTokens 902
 *
 * The letter needed ~270 tokens. The model spent ~900 thinking first. At the
 * original ceiling of 1200 it finished with 27 tokens to spare on a short
 * resume — and ran straight off the end on a real one, emitting a letter that
 * stopped mid-sentence.
 *
 * So the budget must cover REASONING + OUTPUT, and reasoning is the bigger and
 * far less predictable half. Length is controlled by the prompt ("under 300
 * words"), never by starving the ceiling.
 */
const MAX_OUTPUT_TOKENS = 4096

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
  const { text, usage, finishReason } = await generateText({
    model: aiModel,
    system: COVER_LETTER_SYSTEM_PROMPT,
    prompt: buildCoverLetterPrompt(resumeText, jobDescription, company, role),
    temperature: 0.7,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  })

  return {
    text: text.trim(),
    finishReason,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      // Nested under outputTokenDetails, not on usage directly — reasoning is a
      // BREAKDOWN of outputTokens, not an extra category beside it. Worth
      // logging separately because it's the half that actually moves, and the
      // half you cannot see by looking at the letter.
      reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? 0,
    },
  }
}
