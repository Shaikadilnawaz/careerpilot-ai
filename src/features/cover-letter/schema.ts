import { z } from "zod"

/**
 * Cover letter domain.
 *
 * 📌 Note what ISN'T here: an output schema. Week 3's analysis and Week 4's
 * tailored resume both needed `generateObject` because their output was DATA —
 * scores, arrays of issues, structured resume sections. A cover letter is
 * prose. Forcing it through a schema would cost tokens and make every letter
 * read like the same filled-in template.
 *
 * So the model returns a string, and the only schema we need is for INPUT.
 */

export const MAX_CL_JD_CHARS = 12_000

export const coverLetterInputSchema = z.object({
  resumeId: z.string().min(1, "Missing resume id."),
  jobDescription: z
    .string()
    .trim()
    .min(50, "Paste the job description so the letter has something to target.")
    .max(MAX_CL_JD_CHARS, "That job description is too long."),
  company: z.string().trim().min(1, "Company name is required.").max(120),
  role: z.string().trim().min(1, "Role title is required.").max(160),
})

export type CoverLetterInput = z.infer<typeof coverLetterInputSchema>

/** What the PDF letterhead prints. Edited by the user, not generated. */
export interface CoverLetterHeader {
  fullName: string
  contact: string
  company: string
  role: string
}
