"use client"

/**
 * AnalysisResult — renders one analysis.
 *
 * Deliberately a PURE presentational component: it takes a result object and
 * renders it. No data fetching, no Server Action calls, no auth. That means you
 * can drop it into Week 4's application tracker to show a saved analysis without
 * changing a line — the data has to come from somewhere, but this component
 * doesn't care where.
 */
import { AlertTriangle, CheckCircle2, Info, Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { AnalysisResult as Result, JobMatch } from "../schema"

/** Score → colour. One helper so the ATS score and match score never disagree. */
function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-destructive"
}

const VERDICT_LABEL: Record<Result["verdict"], string> = {
  excellent: "Excellent",
  good: "Good",
  needs_work: "Needs work",
  poor: "Poor",
}

const SEVERITY_VARIANT = {
  critical: "destructive",
  important: "secondary",
  minor: "outline",
} as const

/** A big number with a label. Used for both scores. */
function ScoreDial({
  score,
  label,
  caption,
}: {
  score: number
  label: string
  caption?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl bg-muted/40 px-6 py-4 text-center">
      <span className={cn("text-4xl font-semibold tabular-nums", scoreTone(score))}>
        {score}
      </span>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {caption ? (
        <span className="text-muted-foreground text-xs">{caption}</span>
      ) : null}
    </div>
  )
}

/** One issue / tailoring suggestion. Problem + fix, always paired. */
function IssueRow({
  severity,
  area,
  problem,
  fix,
}: Result["issues"][number]) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_VARIANT[severity]}>{severity}</Badge>
        <span className="text-sm font-medium">{area}</span>
      </div>
      <p className="text-muted-foreground text-sm">{problem}</p>
      <p className="text-sm">
        <span className="text-muted-foreground font-medium">Fix: </span>
        {fix}
      </p>
    </li>
  )
}

function KeywordGroup({
  title,
  words,
  tone,
}: {
  title: string
  words: string[]
  tone: "matched" | "missing"
}) {
  if (words.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word) => (
          <Badge
            key={word}
            variant={tone === "matched" ? "secondary" : "outline"}
            className={cn(
              tone === "matched" &&
                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            )}
          >
            {word}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function JobMatchSection({ match }: { match: JobMatch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4" />
          Job match
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ScoreDial score={match.matchScore} label="Match score" />
          <div className="flex flex-1 flex-col gap-3">
            <KeywordGroup
              title="Found in your resume"
              words={match.matchedKeywords}
              tone="matched"
            />
            <KeywordGroup
              title="Missing from your resume"
              words={match.missingKeywords}
              tone="missing"
            />
          </div>
        </div>

        {match.tailoringSuggestions.length > 0 ? (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                How to tailor it for this role
              </span>
              <ul className="flex flex-col gap-2">
                {match.tailoringSuggestions.map((item, i) => (
                  <IssueRow key={i} {...item} />
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AnalysisResult({ result }: { result: Result }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4" />
            ATS analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <ScoreDial
              score={result.atsScore}
              label="ATS score"
              caption={VERDICT_LABEL[result.verdict]}
            />
            <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
              {result.summary}
            </p>
          </div>

          {result.strengths.length > 0 ? (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  What&apos;s working
                </span>
                <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
                  {result.strengths.map((strength, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}

          {result.issues.length > 0 ? (
            <>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                  What to fix
                </span>
                <ul className="flex flex-col gap-2">
                  {result.issues.map((issue, i) => (
                    <IssueRow key={i} {...issue} />
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {result.jobMatch ? <JobMatchSection match={result.jobMatch} /> : null}

      <p className="text-muted-foreground text-xs">
        These are AI-generated suggestions — review every change before using it.
        CareerPilot never edits or submits anything on your behalf.
      </p>
    </div>
  )
}
