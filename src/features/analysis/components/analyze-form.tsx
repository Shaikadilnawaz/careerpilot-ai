"use client"

/**
 * AnalyzeForm — pick a resume, optionally paste a job description, run the AI.
 *
 * This is the Client Component half of the Server Action story. Notice what it
 * DOESN'T do: it never imports the AI SDK, never sees the API key, never knows
 * the prompt. It imports one async function and calls it. Next.js turns that
 * call into a POST; everything else stays on the server.
 */
import * as React from "react"
import { Loader2, Sparkles, FileText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/auth-context"
import type { Resume } from "@/features/resumes/schema"
import { subscribeToResumes } from "@/features/resumes/services/resume-service"

import { analyzeResume } from "../actions/analyze-resume"
import { MAX_JD_CHARS, type AnalysisResult as Result } from "../schema"
import { AnalysisResult } from "./analysis-result"

/**
 * 📌 The real call takes 13-18 seconds. A bare spinner for that long reads as
 * "the app is broken". Rotating status text costs nothing and makes the wait
 * feel like progress instead of a hang. It is honest, too — these really are
 * the stages the request goes through.
 */
const PENDING_STAGES = [
  "Reading your resume…",
  "Checking ATS compatibility…",
  "Comparing against the job description…",
  "Writing suggestions…",
  "Almost there…",
]

export function AnalyzeForm() {
  const { user } = useAuth()

  const [resumes, setResumes] = React.useState<Resume[] | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [jobDescription, setJobDescription] = React.useState("")
  const [result, setResult] = React.useState<Result | null>(null)
  const [stage, setStage] = React.useState(0)

  /**
   * 📌 useTransition, not a useState boolean.
   * `isPending` stays true for the whole Server Action round-trip INCLUDING the
   * re-render React commits afterwards, so the button can't re-enable a beat
   * early and let an impatient user fire a second call.
   */
  const [isPending, startTransition] = React.useTransition()

  // Reuse the Week 2 live listener — the picker updates the moment a resume is
  // uploaded or deleted in another tab.
  React.useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToResumes(
      user.uid,
      (data) => {
        setResumes(data)
        // Auto-select the newest resume so the common case is one click.
        setSelectedId((current) => current ?? data[0]?.id ?? null)
      },
      (error) => {
        console.error(error)
        toast.error("Could not load your resumes.")
        setResumes([])
      }
    )
    return () => unsubscribe()
  }, [user])

  /**
   * Advance the status text while we wait.
   *
   * 📌 Note what this effect does NOT do: reset the stage when `isPending` goes
   * false. React 19's `react-hooks/set-state-in-effect` lint rule flags calling
   * setState in an effect body, because it causes a second render pass right
   * after the first — the component renders, the effect fires, state changes,
   * it renders again. The fix isn't to silence the rule: it's to move the reset
   * into the event handler that starts the run, where it belongs. Effects are
   * for synchronising with external systems (here, a timer), not for patching
   * up state React could have had correct the first time.
   */
  React.useEffect(() => {
    if (!isPending) return
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, PENDING_STAGES.length - 1))
    }, 3500)
    return () => clearInterval(timer)
  }, [isPending])

  function handleAnalyze() {
    if (!user || !selectedId) return

    // Reset the status text here, in the event handler — not in an effect.
    setStage(0)

    startTransition(async () => {
      // The ID token is fetched fresh on every call. Firebase refreshes it
      // automatically when it's close to expiring, so this is always valid —
      // and it's the ONLY thing proving to the server who we are.
      const idToken = await user.getIdToken()

      const response = await analyzeResume({
        idToken,
        resumeId: selectedId,
        // Empty textarea → undefined, which selects the ATS-only schema.
        jobDescription: jobDescription.trim() || undefined,
      })

      if (!response.ok) {
        toast.error(response.error)
        return
      }

      setResult(response.result)
      toast.success("Analysis complete.")
    })
  }

  if (resumes === null) {
    return <Skeleton className="h-40 w-full rounded-xl" />
  }

  if (resumes.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <FileText className="size-7" />
        <p className="text-sm">Upload a resume first, then come back to analyze it.</p>
      </div>
    )
  }

  const overLimit = jobDescription.length > MAX_JD_CHARS

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Which resume?</Label>
            <div className="flex flex-col gap-2">
              {resumes.map((resume) => (
                <button
                  key={resume.id}
                  type="button"
                  onClick={() => setSelectedId(resume.id)}
                  disabled={isPending}
                  aria-pressed={selectedId === resume.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    "disabled:pointer-events-none disabled:opacity-50",
                    selectedId === resume.id
                      ? "border-ring bg-muted/60"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <FileText className="text-muted-foreground size-4 shrink-0" />
                  <span className="truncate">{resume.fileName}</span>
                  {resume.status === "no_text" ? (
                    <span className="text-destructive ml-auto text-xs">
                      no text found
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="jd">
                Job description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  overLimit ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {jobDescription.length.toLocaleString()} /{" "}
                {MAX_JD_CHARS.toLocaleString()}
              </span>
            </div>
            <Textarea
              id="jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={isPending}
              placeholder="Paste the job posting here to also get a match score, keyword gaps, and tailoring suggestions. Leave blank for a general ATS review."
              className="min-h-32"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={isPending || !selectedId || overLimit}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isPending ? "Analyzing…" : "Analyze resume"}
            </Button>
            {isPending ? (
              <span className="text-muted-foreground text-sm">
                {PENDING_STAGES[stage]}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {result ? <AnalysisResult result={result} /> : null}
    </div>
  )
}
