import type { Metadata } from "next"
import { Briefcase } from "lucide-react"

export const metadata: Metadata = {
  title: "Applications · CareerPilot AI",
}

export default function ApplicationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground text-sm">
          Track every application from wishlist to offer.
        </p>
      </div>
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
        <Briefcase className="size-8" />
        <p className="text-sm">The application tracker arrives in Week 4.</p>
      </div>
    </div>
  )
}
