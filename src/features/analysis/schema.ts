import { z } from "zod"
import type { Timestamp } from "firebase/firestore"

/**
 * Analysis domain — the contract between us and the LLM.
 *
 * Read the `.describe()` calls as PROMPT TEXT, not documentation. The AI SDK
 * converts this Zod schema into JSON Schema and hands it to Gemini's structured
 * output mode, descriptions included. A description sitting directly on the
 * field it governs steers the model far more reliably than the same sentence
 * buried in a paragraph of prompt.
 *
 * One schema, three jobs:
 *   compile-time  → TypeScript infers the result type (no casts, no `any`)
 *   request-time  → becomes JSON Schema that constrains what the model can emit
 *   response-time → re-validates the JSON that actually came back
 */

// ---------------------------------------------------------------------------
// Input validation (what the client is allowed to send us)
// ---------------------------------------------------------------------------

export const MAX_JD_CHARS = 12_000

/**
 * Note what the client sends: an ID and their own text. NOT the resume content,
 * NOT a uid. Identity comes from the verified token; the resume is re-read from
 * Firestore using that uid. The client tells us *which* resume, never *whose*.
 */
export const analyzeInputSchema = z.object({
  resumeId: z.string().min(1, "Missing resume id."),
  /**
   * Optional: with a JD we also produce a job-match section, without one we
   * return the generic ATS review only.
   */
  jobDescription: z
    .string()
    .trim()
    .max(MAX_JD_CHARS, "That job description is too long.")
    .optional(),
})

export type AnalyzeInput = z.infer<typeof analyzeInputSchema>

// ---------------------------------------------------------------------------
// AI output contract
// ---------------------------------------------------------------------------

/**
 * 📌 Gemini's `responseSchema` supports only a subset of JSON Schema. Unions,
 * records, and deeply nested optionals are unreliable. Everything below is
 * therefore flat, required, and built from primitives, enums, and arrays of
 * simple objects. Keep it that way when you extend it.
 *
 * Note also: `.min(0).max(100)` becomes JSON Schema `minimum`/`maximum`, which
 * Gemini treats as a hint rather than a hard constraint. Zod still enforces it
 * on the way back — so an absurd score fails loudly instead of reaching the UI.
 * That's the trade we want: a rare thrown error beats silently rendering "137%".
 */

const severityEnum = z
  .enum(["critical", "important", "minor"])
  .describe(
    "How much this hurts the candidate. 'critical' means an ATS may reject or misparse the resume outright."
  )

/** A single actionable fix. Always paired with a reason — a copilot explains itself. */
const issueSchema = z.object({
  severity: severityEnum,
  area: z
    .string()
    .describe(
      "Short label for the part of the resume this concerns, e.g. 'Work experience', 'Formatting', 'Skills section'."
    ),
  problem: z
    .string()
    .describe("What is wrong, stated in one specific sentence. Never generic filler."),
  fix: z
    .string()
    .describe(
      "Concrete rewritten text or a precise instruction the candidate can act on immediately."
    ),
})

/**
 * The always-present part: how well this resume survives an ATS, independent of
 * any particular job.
 */
export const atsAnalysisSchema = z.object({
  atsScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe(
      "ATS compatibility score 0-100. 90+ = parses cleanly with strong quantified content. 50-70 = readable but weak. Below 40 = likely mis-parsed or rejected. Score strictly; most real resumes land 55-75."
    ),
  verdict: z
    .enum(["excellent", "good", "needs_work", "poor"])
    .describe("One-word judgement that matches atsScore."),
  summary: z
    .string()
    .describe(
      "Two or three sentences addressed to the candidate as 'you', summarising the resume's overall standing."
    ),
  strengths: z
    .array(z.string())
    .describe(
      "2-4 things this resume genuinely does well, each citing specific evidence from the text. Do not invent praise."
    ),
  issues: z
    .array(issueSchema)
    .describe(
      "3-6 problems, ordered most damaging first. Prefer specific, fixable issues over vague advice."
    ),
})

/**
 * The extra section we request only when the user supplied a job description.
 * Keywords are the evidence behind the score — they let the user check our work
 * instead of trusting a bare number from an LLM.
 */
export const jobMatchSchema = z.object({
  matchScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("How well this resume matches THIS job description, 0-100."),
  matchedKeywords: z
    .array(z.string())
    .describe(
      "Important skills/terms from the job description that already appear in the resume."
    ),
  missingKeywords: z
    .array(z.string())
    .describe(
      "Important skills/terms from the job description absent from the resume. Only list ones the candidate could plausibly and honestly claim."
    ),
  tailoringSuggestions: z
    .array(issueSchema)
    .describe(
      "3-5 edits that would make this resume land better for THIS role specifically. Never suggest fabricating experience the candidate does not have."
    ),
})

/**
 * 📌 Schema composition instead of an optional field.
 *
 * The obvious move is `jobMatch: jobMatchSchema.optional()` on one schema. We
 * don't, because optional nested objects are exactly where Gemini's schema
 * support gets flaky, and because a required field is a much stronger signal to
 * the model than an optional one. Instead we pick the schema at call time: no
 * JD → `atsAnalysisSchema`, JD → this. Both are derived from one base, so
 * there's no duplication and TypeScript still infers everything.
 */
export const atsWithJobMatchSchema = atsAnalysisSchema.extend({
  jobMatch: jobMatchSchema,
})

export type AtsAnalysis = z.infer<typeof atsAnalysisSchema>
export type JobMatch = z.infer<typeof jobMatchSchema>
export type AtsWithJobMatch = z.infer<typeof atsWithJobMatchSchema>

/** What the AI returns in either mode — `jobMatch` present only in JD mode. */
export type AnalysisResult = AtsAnalysis & { jobMatch?: JobMatch }

// ---------------------------------------------------------------------------
// Firestore document
// ---------------------------------------------------------------------------

/**
 * Stored at users/{uid}/analyses/{analysisId}.
 *
 * A sibling collection of `resumes`, not a subcollection of one resume: a single
 * resume gets analysed against many job descriptions, and keeping analyses flat
 * means "all my recent analyses" is a plain query instead of a collection-group
 * query with its own index and its own security rule.
 */
export interface Analysis {
  id: string
  /** Which resume this analysed. Query by this to list one resume's history. */
  resumeId: string
  /** Denormalised so the history list can show a filename without a second read. */
  resumeFileName: string
  /** The JD text we scored against, kept so Week 4 can reuse it for tailoring. */
  jobDescription: string
  /** Convenience flag — avoids checking `jobDescription !== ""` at every call site. */
  hasJobDescription: boolean
  result: AnalysisResult
  /** Which model produced this. Results are not comparable across models. */
  model: string
  /** Token counts, logged from the start — this is what LLM cost is made of. */
  usage: { inputTokens: number; outputTokens: number }
  createdAt: Timestamp | null
}

/** What we write on create — everything except the generated id. */
export type NewAnalysis = Omit<Analysis, "id">
