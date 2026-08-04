import { z } from "zod"

/**
 * Tailored resume — the contract between us, the model, and the PDF renderer.
 *
 * The AI returns DATA, never formatted text. That single decision is what makes
 * the rest possible: a template renders it identically every time, the user can
 * edit one bullet without touching the rest, and the output is ATS-friendly by
 * construction rather than by luck.
 *
 * 📌 Shape rules (learned in Week 3): Gemini's structured-output mode supports
 * only a subset of JSON Schema. Everything here is flat, required, and built
 * from primitives and arrays of simple objects. Note `contact` is ONE string
 * rather than a nested { email, phone, github } object — nested objects are
 * where Gemini's schema support gets unreliable, and a single line is exactly
 * what the PDF header prints anyway.
 */

export const MAX_TAILOR_JD_CHARS = 12_000

/** What the client may send. Same rule as Week 3: a reference, not the content. */
export const tailorInputSchema = z.object({
  resumeId: z.string().min(1, "Missing resume id."),
  jobDescription: z
    .string()
    .trim()
    .min(50, "Paste the job description so we know what to tailor for.")
    .max(MAX_TAILOR_JD_CHARS, "That job description is too long."),
})

export type TailorInput = z.infer<typeof tailorInputSchema>

const experienceSchema = z.object({
  role: z.string().describe("Job title exactly as the candidate held it."),
  company: z.string().describe("Employer name."),
  period: z
    .string()
    .describe(
      "Dates as they appeared in the original, e.g. 'May 2024 - Jan 2025'. Never invent or adjust dates."
    ),
  bullets: z
    .array(z.string())
    .describe(
      "2-4 achievement bullets. Start with a strong action verb, name the technology used, and include a measurable outcome WHEN THE ORIGINAL SUPPORTS ONE. Never fabricate numbers."
    ),
})

const projectSchema = z.object({
  name: z.string().describe("Project name."),
  tech: z
    .string()
    .describe("Comma-separated technologies, e.g. 'Next.js, TypeScript, Firebase'."),
  bullets: z
    .array(z.string())
    .describe("1-3 bullets on what was built and what it demonstrates."),
})

const educationSchema = z.object({
  qualification: z.string().describe("Degree or certification."),
  institution: z.string().describe("School or issuing body. Empty string if the original never said."),
  period: z.string().describe("Year or range, exactly as in the original."),
})

/**
 * The full tailored resume the model must produce.
 */
export const tailoredResumeSchema = z.object({
  fullName: z.string().describe("The candidate's name, exactly as written in the original resume."),
  headline: z
    .string()
    .describe(
      "A short professional title aligned to the target role, e.g. 'Frontend Engineer'. Two to four words."
    ),
  contact: z
    .string()
    .describe(
      "One line of contact details separated by ' | ', e.g. 'you@email.com | github.com/you'. Only include details present in the original."
    ),
  summary: z
    .string()
    .describe(
      "2-3 sentences positioning the candidate for THIS job. Concrete skills and technologies only — no 'hard worker', 'team player', or similar filler."
    ),
  experience: z
    .array(experienceSchema)
    .describe("Every role from the original, rewritten. Never drop or invent a role."),
  projects: z.array(projectSchema).describe("Projects from the original, most relevant first."),
  skills: z
    .array(z.string())
    .describe(
      "Skills the candidate genuinely has, ordered with the ones this job asks for first. Never add a skill absent from the original."
    ),
  education: z.array(educationSchema).describe("Education from the original."),
  changeNotes: z
    .array(z.string())
    .describe(
      "3-6 plain-language notes telling the candidate what you changed and why, e.g. 'Rewrote the TechCorp bullets to lead with React and add measurable outcomes.'"
    ),
})

export type TailoredResume = z.infer<typeof tailoredResumeSchema>
export type TailoredExperience = z.infer<typeof experienceSchema>
export type TailoredProject = z.infer<typeof projectSchema>
