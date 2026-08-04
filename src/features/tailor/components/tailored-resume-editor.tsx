"use client"

/**
 * TailoredResumeEditor — review, edit, and download an AI-written resume.
 *
 * 📌 A CONTROLLED component: it owns no draft state. The parent holds the draft
 * and passes `onChange`. That's what lets the same editor sit inside the analyze
 * flow, a standalone page, or (later) an application detail view, while the
 * parent decides what else to do with the data — like re-scoring it.
 *
 * The one thing it does own is PDF generation, because that's a pure function of
 * the draft and nobody else needs it.
 */
import * as React from "react"
import { Loader2, Download, Info } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

import type { TailoredResume } from "../schema"

/** A block of editable bullets. Used for both experience and projects. */
function BulletEditor({
  bullets,
  onChange,
}: {
  bullets: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {bullets.map((bullet, i) => (
        <Textarea
          key={i}
          value={bullet}
          onChange={(e) => {
            // Immutable update: copy, replace one item, hand back a new array.
            // Mutating bullets[i] in place would not re-render — React compares
            // by reference, and the reference wouldn't have changed.
            const next = [...bullets]
            next[i] = e.target.value
            onChange(next)
          }}
          className="min-h-14 text-sm"
        />
      ))}
    </div>
  )
}

export function TailoredResumeEditor({
  draft,
  onChange,
  extraActions,
}: {
  draft: TailoredResume
  onChange: (next: TailoredResume) => void
  /** Rendered next to Download — used for "Re-check score". */
  extraActions?: React.ReactNode
}) {
  const [downloading, setDownloading] = React.useState(false)

  function patch(update: Partial<TailoredResume>) {
    onChange({ ...draft, ...update })
  }

  /**
   * 📌 The PDF library is imported HERE, inside the handler, not at module top.
   * It's heavy and browser-only, so lazy-loading keeps it out of the page's
   * initial JS — people who never download never pay for it.
   */
  async function handleDownload() {
    setDownloading(true)
    try {
      const [{ pdf }, { ResumeDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./resume-pdf"),
      ])

      const blob = await pdf(<ResumeDocument data={draft} />).toBlob()

      // Browsers can't save a Blob directly — point a temporary <a> at an
      // object URL and click it programmatically.
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${draft.fullName.replace(/\s+/g, "-") || "resume"}-tailored.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url) // release the memory it was holding

      toast.success("PDF downloaded.")
    } catch (error) {
      console.error(error)
      toast.error("Could not generate the PDF.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {draft.changeNotes.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Info className="size-4" />
              What changed
            </span>
            <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
              {draft.changeNotes.map((note, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">
              Review and edit before downloading
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {extraActions}
              <Button onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download PDF
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={draft.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-headline">Headline</Label>
              <Input
                id="t-headline"
                value={draft.headline}
                onChange={(e) => patch({ headline: e.target.value })}
                className="h-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-contact">Contact line</Label>
            <Input
              id="t-contact"
              value={draft.contact}
              onChange={(e) => patch({ contact: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-summary">Summary</Label>
            <Textarea
              id="t-summary"
              value={draft.summary}
              onChange={(e) => patch({ summary: e.target.value })}
              className="min-h-20"
            />
          </div>

          {draft.experience.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-4">
                <span className="text-sm font-medium">Experience</span>
                {draft.experience.map((job, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{job.role}</span>
                      <span className="text-muted-foreground text-xs">
                        {job.company} · {job.period}
                      </span>
                    </div>
                    <BulletEditor
                      bullets={job.bullets}
                      onChange={(bullets) => {
                        const next = [...draft.experience]
                        next[i] = { ...next[i], bullets }
                        patch({ experience: next })
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {draft.projects.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-4">
                <span className="text-sm font-medium">Projects</span>
                {draft.projects.map((project, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{project.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {project.tech}
                      </span>
                    </div>
                    <BulletEditor
                      bullets={project.bullets}
                      onChange={(bullets) => {
                        const next = [...draft.projects]
                        next[i] = { ...next[i], bullets }
                        patch({ projects: next })
                      }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-skills">Skills (comma separated)</Label>
            <Textarea
              id="t-skills"
              value={draft.skills.join(", ")}
              onChange={(e) =>
                patch({
                  skills: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-16"
            />
          </div>

          <p className="text-muted-foreground text-xs">
            Everything here is an AI draft. Check every line against what you
            actually did — you are the one who has to defend it in an interview.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
