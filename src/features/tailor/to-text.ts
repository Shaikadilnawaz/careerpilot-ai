import type { TailoredResume } from "./schema"

/**
 * Flatten a structured resume back into plain text.
 *
 * 📌 Why this exists: the analyser reads TEXT, because that's what it gets from
 * a real PDF. To re-score a draft we render it the way an ATS would see it.
 * Doing that here — instead of exporting a PDF, re-uploading it, and
 * re-extracting — removes three lossy steps and makes the before/after
 * comparison actually mean something.
 *
 * Mirrors the PDF template's section order and headings, so the text we score
 * resembles the document you would actually send.
 */
export function tailoredResumeToText(resume: TailoredResume): string {
  const lines: string[] = [resume.fullName]

  if (resume.location) lines.push(resume.location)
  if (resume.contact) lines.push(resume.contact)
  lines.push("")

  if (resume.summary) {
    lines.push("PROFESSIONAL SUMMARY", resume.summary, "")
  }

  if (resume.education.length > 0) {
    lines.push("EDUCATION")
    for (const item of resume.education) {
      lines.push(`${item.institution} (${item.period})`)
      lines.push(
        [item.qualification, item.detail].filter(Boolean).join(" — ")
      )
    }
    lines.push("")
  }

  if (resume.experience.length > 0) {
    lines.push("EXPERIENCE")
    for (const job of resume.experience) {
      lines.push(`${job.role}, ${job.company} (${job.period})`)
      for (const bullet of job.bullets) lines.push(`- ${bullet}`)
      lines.push("")
    }
  }

  if (resume.skillCategories.length > 0) {
    lines.push("TECHNICAL SKILLS")
    for (const group of resume.skillCategories) {
      lines.push(`${group.category}: ${group.items.join(", ")}`)
    }
    lines.push("")
  }

  if (resume.projects.length > 0) {
    lines.push("PROJECTS")
    for (const project of resume.projects) {
      lines.push(`${project.name} — ${project.tech}`)
      for (const bullet of project.bullets) lines.push(`- ${bullet}`)
      lines.push("")
    }
  }

  if (resume.certifications.length > 0) {
    lines.push("CERTIFICATIONS")
    for (const item of resume.certifications) lines.push(`- ${item}`)
    lines.push("")
  }

  if (resume.achievements.length > 0) {
    lines.push("ACHIEVEMENTS")
    for (const item of resume.achievements) lines.push(`- ${item}`)
  }

  return lines.join("\n").trim()
}
