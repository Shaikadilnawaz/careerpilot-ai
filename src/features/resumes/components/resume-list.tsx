"use client"

/**
 * ResumeList — a live, real-time list of the current user's resumes.
 *
 * It subscribes to Firestore with onSnapshot (via the service) inside useEffect,
 * so the list re-renders the instant a resume is added or deleted — no manual
 * refresh, no refetch. The effect returns the unsubscribe function so the
 * listener is torn down on unmount (the same cleanup discipline as the auth
 * listener).
 */
import * as React from "react"
import { FileText } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import type { Resume } from "../schema"
import { subscribeToResumes } from "../services/resume-service"
import { ResumeCard } from "./resume-card"

export function ResumeList() {
  const { user } = useAuth()
  // null = still loading the first snapshot; [] = loaded and genuinely empty.
  const [resumes, setResumes] = React.useState<Resume[] | null>(null)

  React.useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToResumes(
      user.uid,
      (data) => setResumes(data),
      (error) => {
        console.error(error)
        toast.error("Could not load your resumes.")
        setResumes([])
      }
    )
    return () => unsubscribe()
  }, [user])

  if (resumes === null) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (resumes.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
        <FileText className="size-7" />
        <p className="text-sm">No resumes yet. Upload one to get started.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {resumes.map((resume) => (
        <ResumeCard key={resume.id} resume={resume} uid={user!.uid} />
      ))}
    </div>
  )
}
