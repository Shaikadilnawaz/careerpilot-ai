"use client"

/**
 * ResumeUploader — the client-side orchestrator for the whole upload flow.
 *
 * It's a Client Component ("use client") because it needs state, refs, drag &
 * drop events, and the browser File API — none of which exist on the server.
 *
 * Flow when a file is chosen:
 *   validate (Zod) → ask our server to authorize an upload → send the bytes
 *   straight to Vercel Blob → extract text (Server Action) → save one Firestore
 *   metadata doc. The live list updates itself via its own onSnapshot listener,
 *   so we don't touch it here.
 *
 * 📌 The bytes never pass through our server. `upload()` first POSTs to
 * /api/resumes/upload, which verifies the Firebase ID token and returns a token
 * scoped to one path, one content type, and one size limit; the browser then
 * PUTs the file directly to blob storage. This is the same presigned-upload
 * pattern used by S3 and GCS, and it's what keeps us under the 1 MB cap on
 * Server Action request bodies.
 */
import * as React from "react"
import { UploadCloud, Loader2, FileText } from "lucide-react"
import { toast } from "sonner"
import { upload } from "@vercel/blob/client"

import { useAuth } from "@/features/auth/auth-context"
import { cn } from "@/lib/utils"
import { resumeFileSchema } from "../schema"
import { newResumeRef, saveResume } from "../services/resume-service"
import { extractResumeText } from "../actions/extract-text"

type Phase = "idle" | "uploading" | "processing"

export function ResumeUploader() {
  const { user } = useAuth()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [progress, setProgress] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)

  const busy = phase !== "idle"

  async function handleFile(file: File) {
    if (!user) {
      toast.error("You must be signed in to upload.")
      return
    }

    // 1. Validate BEFORE we waste an upload. Zod gives us the exact reason.
    const result = resumeFileSchema.safeParse(file)
    if (!result.success) {
      toast.error(result.error.issues[0].message)
      return
    }

    try {
      // 2. Reserve an id + blob pathname so the file and its metadata share one id.
      const { resumeId, blobPathname } = newResumeRef(user.uid)

      // 3. Upload the bytes DIRECTLY to blob storage.
      setPhase("uploading")
      setProgress(0)

      // Fetched fresh each time; Firebase auto-refreshes it near expiry. This
      // is the only thing proving to our Route Handler who is uploading.
      const idToken = await user.getIdToken()

      const blob = await upload(blobPathname, file, {
        access: "private",
        contentType: file.type,
        // Our Route Handler — it authorizes before any token is minted.
        handleUploadUrl: "/api/resumes/upload",
        clientPayload: JSON.stringify({ idToken }),
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })

      // 4. Extract text on the server. We ship the File via FormData.
      setPhase("processing")
      const formData = new FormData()
      formData.append("file", file)
      const extraction = await extractResumeText(formData)

      const extractedText = extraction.ok ? extraction.text : ""
      // A scanned/image-only PDF yields no text — flag it so the UI can warn.
      const status = extractedText.length > 0 ? "ready" : "no_text"

      // 5. Write the single metadata document.
      await saveResume(user.uid, resumeId, {
        fileName: file.name,
        sizeBytes: file.size,
        contentType: file.type,
        blobPathname,
        // Private URL — not viewable on its own. Stored so we can sign it for
        // previews and hand it to the delete API later.
        blobUrl: blob.url,
        extractedText,
        status,
      })

      if (status === "no_text") {
        toast.warning(
          `${file.name} uploaded, but no text was found (is it a scanned image?).`
        )
      } else {
        toast.success(`${file.name} uploaded.`)
      }
    } catch (error) {
      console.error(error)
      toast.error("Upload failed. Please try again.")
    } finally {
      setPhase("idle")
      setProgress(0)
      if (inputRef.current) inputRef.current.value = "" // allow re-picking same file
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault()
    setIsDragging(false)
    if (busy) return
    const file = event.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!busy) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40",
        busy && "pointer-events-none opacity-80"
      )}
    >
      {/* Hidden native input; the whole card is the click target via the label. */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onInputChange}
        disabled={busy}
        className="hidden"
        id="resume-file-input"
      />

      {phase === "idle" && (
        <>
          <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
            <UploadCloud className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="resume-file-input"
              className="text-primary cursor-pointer text-sm font-medium hover:underline"
            >
              Click to upload
            </label>
            <p className="text-muted-foreground text-xs">
              or drag & drop — PDF only, up to 5 MB
            </p>
          </div>
        </>
      )}

      {phase === "uploading" && (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <FileText className="size-4" />
            Uploading… {progress}%
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Reading your resume…
        </div>
      )}
    </div>
  )
}
