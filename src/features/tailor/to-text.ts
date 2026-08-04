import type { TailoredResume } from "./schema"

/**
 * Flatten a structured resume back into plain text.
 *
 * 📌 Why this exists: the analyser reads TEXT, because that's what it gets from
 * a real PDF. To re-score a draft we have to render it the way an ATS would see
 * it. Doing that here — rather than exporting a PDF, re-uploading it, and
 * re-extracting — removes three lossy steps and makes the before/after
 * comparison actually mean something.
 *
 * Deliberately mirrors the section order and uppercase headings used by the PDF
 * template, so the text we score resembles the document you'd actually send.
 */
export function tailoredResumeToText(resume: TailoredResume): string {
  const lines: string[] = [resume.fullName, resume.headline, resume.contact, ""]

  if (resume.summary) {
    lines.push("SUMMARY", resume.summary, "")
  }

  if (resume.experience.length > 0) {
    lines.push("EXPERIENCE")
    for (const job of resume.experience) {
      lines.push(`${job.role}, ${job.company} (${job.period})`)
      for (const bullet of job.bullets) lines.push(`- ${bullet}`)
      lines.push("")
    }
  }

  if (resume.projects.length > 0) {
    lines.push("PROJECTS")
    for (const project of resume.projects) {
      lines.push(`${project.name} — ${project.tech}`)
      for (const bullet of project.bullets) lines.push(`- ${bullet}`)
      lines.push("")
    }
  }

  if (resume.skills.length > 0) {
    lines.push("SKILLS", resume.skills.join(", "), "")
  }

  if (resume.education.length > 0) {
    lines.push("EDUCATION")
    for (const item of resume.education) {
      lines.push(
        [item.qualification, item.institution, item.period]
          .filter(Boolean)
          .join(", ")
      )
    }
  }

  return lines.join("\n").trim()
}
