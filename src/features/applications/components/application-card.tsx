"use client"

/**
 * ApplicationCard — one row in the tracker.
 *
 * The status dropdown writes straight to Firestore. There's no local state for
 * it and no manual list refresh: the onSnapshot listener in ApplicationList
 * re-renders the moment the write lands. That's the payoff of a real-time
 * database — "optimistic UI" you didn't have to write.
 */
import * as React from "react"
import {
  Building2,
  ExternalLink,
  Trash2,
  Loader2,
  ChevronDown,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/features/auth/auth-context"

import {
  APPLICATION_STATUSES,
  STATUS_LABEL,
  type Application,
  type ApplicationStatus,
} from "../schema"
import {
  deleteApplication,
  updateApplicationStatus,
} from "../services/application-service"

/** Colour per stage — green for good news, red for closed, neutral early on. */
const STATUS_VARIANT: Record<
  ApplicationStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  saved: "outline",
  applied: "secondary",
  interviewing: "default",
  offer: "default",
  rejected: "destructive",
}

export function ApplicationCard({ application }: { application: Application }) {
  const { user } = useAuth()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function handleStatus(status: ApplicationStatus) {
    if (!user || status === application.status) return
    try {
      await updateApplicationStatus(user.uid, application.id, status)
    } catch (error) {
      console.error(error)
      toast.error("Could not update status.")
    }
  }

  async function handleDelete() {
    if (!user) return
    setBusy(true)
    try {
      await deleteApplication(user.uid, application.id)
      toast.success(`${application.company} removed.`)
    } catch (error) {
      console.error(error)
      toast.error("Could not delete this application.")
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div className="bg-card flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
          <Building2 className="size-5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium">{application.role}</p>
          <p className="text-muted-foreground truncate text-xs">
            {application.company}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Badge variant={STATUS_VARIANT[application.status]}>
                    {STATUS_LABEL[application.status]}
                  </Badge>
                  <ChevronDown />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {APPLICATION_STATUSES.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => handleStatus(status)}
                >
                  {STATUS_LABEL[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {application.jobUrl && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open job posting"
              nativeButton={false}
              render={
                <a
                  href={application.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <ExternalLink />
            </Button>
          )}

          {confirming ? (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? <Loader2 className="animate-spin" /> : "Delete"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete application"
              onClick={() => setConfirming(true)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>

      {(application.resumeFileName || application.notes) && (
        <div className="text-muted-foreground flex flex-col gap-1 pl-13 text-xs">
          {application.resumeFileName && (
            <span className="flex items-center gap-1.5">
              <FileText className="size-3" />
              {application.resumeFileName}
            </span>
          )}
          {application.notes && <p className="line-clamp-2">{application.notes}</p>}
        </div>
      )}
    </div>
  )
}
