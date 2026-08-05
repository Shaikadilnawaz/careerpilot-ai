"use client"

/**
 * CoverLetterEditor — review, edit, and download a generated letter.
 *
 * Controlled, like TailoredResumeEditor: the parent owns the state, this owns
 * only PDF generation. Same copilot rule as everywhere else — there is no path
 * from "generate" straight to a file.
 *
 * 📌 The whole letter is ONE textarea, not a per-paragraph editor. That's the
 * `generateText` decision showing up in the UI: because we never imposed a
 * structure on the output, there are no fields to bind to. Prose in, prose out,
 * edited as prose. Structure would have bought per-paragraph inputs nobody
 * needs for a 300-word letter.
 */
import * as React from "react"
import { Loader2, Download, Copy, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

import type { CoverLetterHeader } from "../schema"

export function CoverLetterEditor({
  header,
  onHeaderChange,
  body,
  onBodyChange,
}: {
  header: CoverLetterHeader
  onHeaderChange: (next: CoverLetterHeader) => void
  body: string
  onBodyChange: (next: string) => void
}) {
  const [downloading, setDownloading] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  function patch(update: Partial<CoverLetterHeader>) {
    onHeaderChange({ ...header, ...update })
  }

  /** Lazy-loaded for the same reason as the resume PDF: heavy, browser-only. */
  async function handleDownload() {
    setDownloading(true)
    try {
      const [{ pdf }, { CoverLetterDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./cover-letter-pdf"),
      ])

      const blob = await pdf(
        <CoverLetterDocument header={header} body={body} />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      const company = header.company.replace(/\s+/g, "-") || "cover-letter"
      link.download = `${company}-cover-letter.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast.success("Cover letter downloaded.")
    } catch (error) {
      console.error(error)
      toast.error("Could not generate the PDF.")
    } finally {
      setDownloading(false)
    }
  }

  /**
   * Many application forms want the letter pasted into a textarea, not
   * uploaded — so plain-text copy is genuinely the more useful action of the
   * two, and worth having next to Download.
   */
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      // Revert the icon after a moment so the button doesn't look stuck.
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy to clipboard.")
    }
  }

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">
            Review and edit before sending
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy text"}
            </Button>
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
            <Label htmlFor="cl-name">Your name</Label>
            <Input
              id="cl-name"
              value={header.fullName}
              onChange={(e) => patch({ fullName: e.target.value })}
              placeholder="Your full name"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cl-contact">Contact line</Label>
            <Input
              id="cl-contact"
              value={header.contact}
              onChange={(e) => patch({ contact: e.target.value })}
              placeholder="you@email.com | github.com/you"
              className="h-9"
            />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="cl-body">Letter</Label>
            <span className="text-muted-foreground text-xs tabular-nums">
              {wordCount} words
            </span>
          </div>
          <Textarea
            id="cl-body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            className="min-h-80 leading-relaxed"
          />
          <p className="text-muted-foreground text-xs">
            Blank lines separate paragraphs in the PDF. Read every claim and cut
            anything you wouldn&apos;t say out loud in an interview.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
