/**
 * AI client — the ONLY place the LLM provider is named.
 *
 * This is the payoff of Clean Architecture: every AI service (resume analysis,
 * ATS scoring, later cover letters) imports `aiModel` from here. To switch from
 * Gemini to OpenAI, Claude, or Groq, you change ONE line below — no service,
 * component, or Server Action has to change. That's what "provider-agnostic"
 * means in practice, and it's a great thing to be able to explain in an
 * interview.
 *
 * `server-only` ensures the API key never reaches the browser.
 */
import "server-only"
import { google } from "@ai-sdk/google"

/**
 * Gemini 3.6 Flash: fast, cheap, strong at structured output, and available on
 * the free tier. The provider automatically reads GOOGLE_GENERATIVE_AI_API_KEY.
 *
 * 📌 We originally targeted `gemini-2.0-flash`. By the time Week 3 was built it
 * returned HTTP 429 with `limit: 0` — not "quota used up" but "this model has no
 * free-tier allocation at all" — and `gemini-2.5-flash` 404s as retired. Models
 * get deprecated faster than projects get finished. Because the model name lives
 * in this ONE file, that migration was a one-line change.
 *
 * 📌 Deliberately pinned to an exact version rather than the `gemini-flash-latest`
 * alias. An auto-updating alias would silently change the model underneath a
 * SCORING feature — the same resume could score differently next week with no
 * commit to explain it. Pin it, and upgrade on purpose.
 */
export const aiModel = google("gemini-3.6-flash")
