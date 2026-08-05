import type { Metadata } from "next"

import { AnalyzeForm } from "@/features/analysis/components/analyze-form"

export const metadata: Metadata = {
  title: "Analyze · CareerPilot AI",
}

/**
 * 📌 Every AI feature on this site runs from THIS page, and each call takes
 * 12-18 seconds — analysis, tailoring, re-check, cover letter.
 *
 * Serverless functions have a default timeout well under that on most hosts, so
 * without this the request is killed mid-generation and the user sees a generic
 * failure after paying the full wait. Per the Next.js docs, setting
 * `maxDuration` at the PAGE level applies it to every Server Action invoked
 * from that page — you don't set it per action.
 *
 * 60s leaves headroom for a slow model response without letting a hung request
 * bill indefinitely.
 */
export const maxDuration = 60

// Server Component: static layout only. The interactive form is a Client
// Component nested inside, so only its JS ships to the browser.
export default function AnalyzePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analyze</h1>
        <p className="text-muted-foreground text-sm">
          Score a resume for ATS compatibility, match it against a job
          description, then rewrite it for that role and download a clean PDF.
        </p>
      </div>

      <AnalyzeForm />
    </div>
  )
}
