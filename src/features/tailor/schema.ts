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
  link: z
    .string()
    .describe(
      "A URL for this project ONLY if one appears in the original resume. Copy it exactly. Empty string otherwise — never guess or construct a URL."
    ),
  bullets: z
    .array(z.string())
    .describe("2-4 bullets on what was built and what it demonstrates."),
})

const educationSchema = z.object({
  institution: z
    .string()
    .describe("School name, with city if the original gives one, e.g. 'Mohan Babu University, Tirupati'."),
  qualification: z.string().describe("Degree or programme, e.g. 'B.Tech in Computer Science and Engineering'."),
  period: z.string().describe("Year range exactly as in the original, e.g. '2023-2027'. Never invent dates."),
  detail: z
    .string()
    .describe(
      "Grade or score exactly as stated, e.g. 'CGPA: 8.0/10' or '88.5%'. Empty string if the original gives none. Never invent a score."
    ),
})

/**
 * 📌 Skills are GROUPED, not one flat list — because the template groups them
 * (Languages / Frontend / Backend / Databases / Tools). A recruiter scanning
 * for "does this person know React" finds it faster under a heading than in a
 * 30-item comma soup, and grouping is also a signal the candidate understands
 * where each technology sits in a stack.
 */
const skillCategorySchema = z.object({
  category: z
    .string()
    .describe("Group name, e.g. 'Languages', 'Frontend', 'Backend', 'Databases', 'Tools'."),
  items: z
    .array(z.string())
    .describe("Skills in this group, ordered with the ones this job asks for first."),
})

/**
 * The full tailored resume the model must produce.
 */
export const tailoredResumeSchema = z.object({
  fullName: z.string().describe("The candidate's name, exactly as written in the original resume."),
  location: z
    .string()
    .describe(
      "City and region as given in the original, e.g. 'Kurnool, Andhra Pradesh'. Empty string if the original has none."
    ),
  contact: z
    .string()
    .describe(
      "Phone and email separated by ' | ', e.g. '+91-9876543210 | you@email.com'. Only what the original contains. Do NOT put GitHub, LinkedIn or portfolio URLs here — those are added separately as links."
    ),
  summary: z
    .string()
    .describe(
      "2-3 sentences positioning the candidate for THIS job. Concrete skills and technologies only — no 'hard worker', 'team player', or similar filler."
    ),
  education: z.array(educationSchema).describe("Every education entry from the original, newest first."),
  experience: z
    .array(experienceSchema)
    .describe(
      "Every job/internship from the original, rewritten. Empty array if the original has no work experience — never invent one."
    ),
  skillCategories: z
    .array(skillCategorySchema)
    .describe(
      "The candidate's skills grouped into 4-6 categories. Only skills present in the original. Never add one they haven't demonstrated."
    ),
  projects: z.array(projectSchema).describe("Every project from the original, most relevant to this job first."),
  certifications: z
    .array(z.string())
    .describe(
      "Certifications exactly as named in the original, e.g. 'Oracle Fusion Cloud ERP Foundations Associate'. Empty array if none."
    ),
  achievements: z
    .array(z.string())
    .describe(
      "Awards, rankings, or notable accomplishments from the original, e.g. 'Top 20 of 100+ teams in a university hackathon'. Empty array if none."
    ),
  changeNotes: z
    .array(z.string())
    .describe(
      "3-6 plain-language notes telling the candidate what you changed and why, e.g. 'Rewrote the TechCorp bullets to lead with React and add measurable outcomes.'"
    ),
})

export type TailoredResume = z.infer<typeof tailoredResumeSchema>

/**
 * Profile links — all optional, and deliberately NOT part of the AI schema.
 *
 * 📌 These are facts the user supplies, not content the model should generate.
 * Routing them through `generateObject` would let the model reformat, truncate,
 * or invent a URL, and a broken link on a resume is worse than no link at all.
 * So they flow around the AI: user input -> editor -> PDF, untouched.
 */
export interface ProfileLinks {
  github: string
  linkedin: string
  portfolio: string
}

export const EMPTY_LINKS: ProfileLinks = {
  github: "",
  linkedin: "",
  portfolio: "",
}

/**
 * Turn what people actually type into something a PDF viewer will open.
 *
 * 📌 Nobody types "https://". They type "github.com/me" or "www.site.com", and
 * a PDF link without a scheme either does nothing or resolves relative to the
 * file. Being forgiving in what we accept and strict in what we emit is the
 * difference between a link that works and one that silently doesn't.
 */
export function normalizeUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value.replace(/^\/+/, "")}`
}

/** What we show as the link text — the URL without the noisy scheme prefix. */
export function displayUrl(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
}
export type TailoredExperience = z.infer<typeof experienceSchema>
export type TailoredProject = z.infer<typeof projectSchema>
