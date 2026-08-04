import type { Metadata } from "next"

import { ResumeUploader } from "@/features/resumes/components/resume-uploader"
import { ResumeList } from "@/features/resumes/components/resume-list"

export const metadata: Metadata = {
  title: "Resumes · CareerPilot AI",
}

// This page stays a Server Component (no "use client"). It's just static layout
// — the interactive parts (uploader, live list) are Client Components nested
// inside. That keeps the page's JS bundle small; only what needs the browser
// ships to the browser.
export default function ResumesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Resumes</h1>
        <p className="text-muted-foreground text-sm">
          Upload, store, and preview your resumes. We&apos;ll analyze them in
          Week 3.
        </p>
      </div>

      <ResumeUploader />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Your resumes</h2>
        <ResumeList />
      </div>
    </div>
  )
}
