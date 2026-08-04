"use client"

/**
 * ApplicationList — live tracker, grouped by pipeline stage.
 *
 * Same listener discipline as ResumeList: subscribe in an effect, tear down on
 * unmount. Grouping happens in the CLIENT, not with five separate Firestore
 * queries — one listener over a user's own applications is cheap, and five
 * queries would cost five times the reads to display the same data.
 */
import * as React from "react"
import { Briefcase } from "lucide-react"
import { toast } from "sonner"

import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/auth-context"

import {
  APPLICATION_STATUSES,
  STATUS_LABEL,
  type Application,
} from "../schema"
import { subscribeToApplications } from "../services/application-service"
import { ApplicationCard } from "./application-card"

export function ApplicationList() {
  const { user } = useAuth()
  // null = first snapshot pending; [] = loaded and genuinely empty.
  const [applications, setApplications] = React.useState<Application[] | null>(
    null
  )

  React.useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToApplications(
      user.uid,
      setApplications,
      (error) => {
        console.error(error)
        toast.error("Could not load your applications.")
        setApplications([])
      }
    )
    return () => unsubscribe()
  }, [user])

  /**
   * 📌 useMemo, not a plain expression: without it we'd rebuild five arrays on
   * every single render — including every keystroke elsewhere on the page. The
   * dependency is the applications array, so grouping only recomputes when
   * Firestore actually pushes new data.
   */
  const grouped = React.useMemo(() => {
    const map = new Map<string, Application[]>()
    for (const status of APPLICATION_STATUSES) map.set(status, [])
    for (const app of applications ?? []) {
      map.get(app.status)?.push(app)
    }
    return map
  }, [applications])

  if (applications === null) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
        <Briefcase className="size-7" />
        <p className="text-sm">
          No applications yet. Add your first one to start tracking.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {APPLICATION_STATUSES.map((status) => {
        const items = grouped.get(status) ?? []
        // Hide empty stages rather than showing five headings and one card.
        if (items.length === 0) return null
        return (
          <section key={status} className="flex flex-col gap-2">
            <h3 className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
              {STATUS_LABEL[status]}
              <span className="bg-muted text-foreground rounded-full px-1.5 py-0.5 text-[10px] tabular-nums">
                {items.length}
              </span>
            </h3>
            <div className="flex flex-col gap-2">
              {items.map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
