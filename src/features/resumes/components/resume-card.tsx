"use client"

/**
 * ResumeCard — one row in the resume list.
 *
 * Shows the metadata we pulled from Firestore (name, size, date, status) and two
 * actions: Preview (mints a short-lived signed URL, since the blob store is
 * private) and Delete (a deliberate two-click confirm so a stray click can't
 * wipe a file).
 */
import * as React from "react"
import { FileText, Trash2, ExternalLink, Loader2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/features/auth/auth-context"
import type { Resume } from "../schema"
import { formatBytes, formatUploadedAt } from "../format"
import {
  deleteResumeAction,
  getResumePreviewUrl,
} from "../actions/resume-actions"

export function ResumeCard({ resume }: { resume: Resume }) {
  const { user } = useAuth()
  const [confirming, setConfirming] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [opening, setOpening] = React.useState(false)

  /**
   * Preview is no longer a plain link. The store is private, so there is no
   * URL that just works — we ask the server to verify we own this resume and
   * mint a 5-minute signed URL.
   *
   * 📌 The popup-blocker trap: browsers only allow window.open() during the
   * synchronous part of a click handler. Opening it AFTER an await looks like
   * an unprompted popup and gets blocked. So we open a blank tab immediately,
   * then point it at the URL once it arrives.
   */
  async function handlePreview() {
    if (!user) return

    /**
     * 📌 Do NOT pass "noopener" here.
     *
     * Per the HTML spec, window.open() returns null whenever noopener is
     * specified — the whole point of the flag is to sever the link between the
     * windows, so there is deliberately no handle to hand back. The original
     * code passed "noopener,noreferrer", so `tab` was always null and the
     * "please allow pop-ups" branch fired every single time, even though the
     * tab had opened fine.
     *
     * Setting `tab.opener = null` after the fact gives us both things we want:
     * a reference we can point at the signed URL, and no opener relationship
     * for the new tab to reach back through.
     */
    const tab = window.open("", "_blank")
    if (tab) tab.opener = null

    setOpening(true)
    try {
      const idToken = await user.getIdToken()
      const result = await getResumePreviewUrl({ idToken, resumeId: resume.id })
      if (!result.ok) {
        tab?.close()
        toast.error(result.error)
        return
      }
      if (tab) tab.location.href = result.url
      else toast.error("Please allow pop-ups to preview your resume.")
    } catch (error) {
      tab?.close()
      console.error(error)
      toast.error("Could not open this resume.")
    } finally {
      setOpening(false)
    }
  }

  async function handleDelete() {
    if (!user) return
    setDeleting(true)
    try {
      const idToken = await user.getIdToken()
      const result = await deleteResumeAction({ idToken, resumeId: resume.id })
      if (!result.ok) throw new Error(result.error)
      toast.success(`${resume.fileName} deleted.`)
      // No manual list update needed — onSnapshot removes it for us.
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Could not delete this resume."
      )
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-3">
      <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
        <FileText className="size-5" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{resume.fileName}</p>
          {resume.status === "no_text" && (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert /> No text
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {formatBytes(resume.sizeBytes)} · {formatUploadedAt(resume.uploadedAt)}
        </p>
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-muted-foreground hidden text-xs sm:inline">
            Delete?
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="animate-spin" /> : "Delete"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={opening}
          >
            {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />}
            Preview
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete resume"
            onClick={() => setConfirming(true)}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  )
}
