import type { Metadata } from "next"

import { AnalyzeForm } from "@/features/analysis/components/analyze-form"

export const metadata: Metadata = {
  title: "Analyze · CareerPilot AI",
}

// Server Component: static layout only. The interactive form is a Client
// Component nested inside, so only its JS ships to the browser.
export default function AnalyzePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Analyze</h1>
        <p className="text-muted-foreground text-sm">
          Score a resume for ATS compatibility, and match it against a specific
          job description.
        </p>
      </div>

      <AnalyzeForm />
    </div>
  )
}
