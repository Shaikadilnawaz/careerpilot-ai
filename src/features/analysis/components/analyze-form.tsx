"use client"

/**
 * AnalyzeForm — the whole resume-optimisation loop on one page.
 *
 * 📌 WHY THIS IS ONE PAGE AND NOT TWO.
 * Analysing and tailoring need the SAME two inputs: a resume and a job
 * description. Splitting them across two routes meant entering the same job
 * description twice. Worse, it broke the natural sequence — after a page tells
 * you "here are 6 problems", the next thing you want is "fix them", not
 * "navigate somewhere else and start again".
 *
 * The flow:
 *   pick resume + paste JD
 *      ├── Analyze → score, issues, keyword gaps
 *      │      └── "Fix these" → tailor
 *      └── Tailor  → rewrite directly (skip the 15s analysis if you don't want it)
 *   tailored draft → edit → Download PDF / Re-check score
 *
 * Both actions stay independently reachable on purpose: forcing an analysis
 * before every tailor would cost two AI calls and ~30 seconds for someone who
 * only wanted the rewrite.
 */
import * as React from "react"
import {
  Loader2,
  Sparkles,
  FileText,
  Wand2,
  ChevronDown,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/auth-context"
import type { Resume } from "@/features/resumes/schema"
import { subscribeToResumes } from "@/features/resumes/services/resume-service"
import { tailorResume } from "@/features/tailor/actions/tailor-resume"
import { recheckDraft } from "@/features/tailor/actions/recheck-draft"
import { TailoredResumeEditor } from "@/features/tailor/components/tailored-resume-editor"
import type { TailoredResume } from "@/features/tailor/schema"

import { analyzeResume } from "../actions/analyze-resume"
import { MAX_JD_CHARS, type AnalysisResult as Result } from "../schema"
import { AnalysisResult } from "./analysis-result"

/** Which long-running job is in flight. One transition, one label for it. */
type Task = "analyze" | "tailor" | "recheck" | null

const STAGES: Record<Exclude<Task, null>, string[]> = {
  analyze: [
    "Reading your resume…",
    "Checking ATS compatibility…",
    "Comparing against the job description…",
    "Writing suggestions…",
  ],
  tailor: [
    "Reading your resume…",
    "Studying the job description…",
    "Rewriting your experience…",
    "Choosing the strongest wording…",
  ],
  recheck: ["Re-scoring your edited draft…"],
}

export function AnalyzeForm() {
  const { user } = useAuth()

  const [resumes, setResumes] = React.useState<Resume[] | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [jobDescription, setJobDescription] = React.useState("")

  const [result, setResult] = React.useState<Result | null>(null)
  const [draft, setDraft] = React.useState<TailoredResume | null>(null)
  const [recheck, setRecheck] = React.useState<Result | null>(null)

  const [task, setTask] = React.useState<Task>(null)
  const [stage, setStage] = React.useState(0)
  /** Collapse the inputs once there's something to look at. */
  const [inputsOpen, setInputsOpen] = React.useState(true)

  const [isPending, startTransition] = React.useTransition()

  React.useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToResumes(
      user.uid,
      (data) => {
        setResumes(data)
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

  React.useEffect(() => {
    if (!isPending || !task) return
    const timer = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES[task].length - 1))
    }, 4000)
    return () => clearInterval(timer)
  }, [isPending, task])

  function run(which: Exclude<Task, null>, work: (idToken: string) => Promise<void>) {
    if (!user || !selectedId) return
    setStage(0)
    setTask(which)
    startTransition(async () => {
      try {
        await work(await user.getIdToken())
      } finally {
        setTask(null)
      }
    })
  }

  function handleAnalyze() {
    run("analyze", async (idToken) => {
      const response = await analyzeResume({
        idToken,
        resumeId: selectedId,
        jobDescription: jobDescription.trim() || undefined,
      })
      if (!response.ok) return void toast.error(response.error)
      setResult(response.result)
      setRecheck(null)
      setInputsOpen(false)
      toast.success("Analysis complete.")
    })
  }

  function handleTailor() {
    run("tailor", async (idToken) => {
      const response = await tailorResume({
        idToken,
        resumeId: selectedId,
        jobDescription: jobDescription.trim(),
      })
      if (!response.ok) return void toast.error(response.error)
      setDraft(response.resume)
      setRecheck(null)
      setInputsOpen(false)
      toast.success("Draft ready — review it before downloading.")
    })
  }

  function handleRecheck() {
    if (!draft) return
    run("recheck", async (idToken) => {
      const response = await recheckDraft({
        idToken,
        draft,
        jobDescription: jobDescription.trim() || undefined,
      })
      if (!response.ok) return void toast.error(response.error)
      setRecheck(response.result)
      toast.success("Re-scored your draft.")
    })
  }

  if (resumes === null) return <Skeleton className="h-40 w-full rounded-xl" />

  if (resumes.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <FileText className="size-7" />
        <p className="text-sm">Upload a resume first, then come back to analyze it.</p>
      </div>
    )
  }

  const jdText = jobDescription.trim()
  const overLimit = jobDescription.length > MAX_JD_CHARS
  // Tailoring needs a job description; a general ATS review does not.
  const canTailor = Boolean(selectedId) && jdText.length >= 50 && !overLimit
  const selectedResume = resumes.find((r) => r.id === selectedId)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-5">
          {!inputsOpen ? (
            <button
              type="button"
              onClick={() => setInputsOpen(true)}
              className="flex items-center justify-between gap-2 text-left text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate">{selectedResume?.fileName}</span>
                {jdText && (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    · job description added
                  </span>
                )}
              </span>
              <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
                Change <ChevronDown className="size-3" />
              </span>
            </button>
          ) : (
            <>
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
                      {resume.status === "no_text" && (
                        <span className="text-destructive ml-auto text-xs">
                          no text found
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="jd">
                    Job description{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional for analysis, required for tailoring)
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
                  placeholder="Paste the job posting here to get a match score, keyword gaps, and a resume rewritten for this role."
                  className="min-h-32"
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={isPending || !selectedId || overLimit}
            >
              {isPending && task === "analyze" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Analyze
            </Button>

            <Button
              variant="outline"
              onClick={handleTailor}
              disabled={isPending || !canTailor}
              // A disabled button with no explanation is a dead end.
              title={
                canTailor ? undefined : "Paste a job description to tailor your resume"
              }
            >
              {isPending && task === "tailor" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Tailor my resume
            </Button>

            {isPending && task && (
              <span className="text-muted-foreground text-sm">
                {STAGES[task][stage]}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="flex flex-col gap-4">
          <AnalysisResult result={result} />

          {/* The natural next click after seeing what's wrong. */}
          {canTailor && !draft && (
            <Button
              onClick={handleTailor}
              disabled={isPending}
              className="self-start"
            >
              {isPending && task === "tailor" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Fix these — tailor my resume
            </Button>
          )}
        </div>
      )}

      {draft && (
        <>
          <Separator />
          <TailoredResumeEditor
            draft={draft}
            onChange={setDraft}
            extraActions={
              <Button
                variant="outline"
                onClick={handleRecheck}
                disabled={isPending}
              >
                {isPending && task === "recheck" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Re-check score
              </Button>
            }
          />

          {recheck && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Score after your edits</h2>
              {/* 📌 Scored from the DRAFT TEXT directly — no PDF export, no
                  re-upload, no re-extraction. Comparing this to the original
                  score compares like with like. */}
              <AnalysisResult result={recheck} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
