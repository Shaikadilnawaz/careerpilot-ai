"use client"

/**
 * ResumeCard — one row in the resume list.
 *
 * Shows the metadata we pulled from Firestore (name, size, date, status) and two
 * actions: Preview (opens the Storage download URL — browsers render PDFs
 * natively) and Delete (a deliberate two-click confirm so a stray click can't
 * wipe a file).
 */
import * as React from "react"
import { FileText, Trash2, ExternalLink, Loader2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Resume } from "../schema"
import { formatBytes, formatUploadedAt } from "../format"
import { deleteResume } from "../services/resume-service"

export function ResumeCard({ resume, uid }: { resume: Resume; uid: string }) {
  const [confirming, setConfirming] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteResume(uid, resume)
      toast.success(`${resume.fileName} deleted.`)
      // No manual list update needed — onSnapshot removes it for us.
    } catch (error) {
      console.error(error)
      toast.error("Could not delete this resume.")
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
            render={
              <a
                href={resume.downloadURL}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLink /> Preview
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
