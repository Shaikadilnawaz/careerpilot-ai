import type { Metadata } from "next"

import { ApplicationForm } from "@/features/applications/components/application-form"
import { ApplicationList } from "@/features/applications/components/application-list"

export const metadata: Metadata = {
  title: "Applications · CareerPilot AI",
}

// Server Component: static layout only. The form and the live list are Client
// Components nested inside, so only their JS ships to the browser.
export default function ApplicationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
        <p className="text-muted-foreground text-sm">
          Track every application from wishlist to offer.
        </p>
      </div>

      <ApplicationForm />
      <ApplicationList />
    </div>
  )
}
