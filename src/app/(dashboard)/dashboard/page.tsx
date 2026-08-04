import type { Metadata } from "next"
import Link from "next/link"
import {
  Briefcase,
  CalendarClock,
  Trophy,
  Gauge,
  FileText,
  Plus,
} from "lucide-react"

import { DashboardGreeting } from "@/features/dashboard/components/dashboard-greeting"
import { StatCard } from "@/features/dashboard/components/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Dashboard · CareerPilot AI",
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <DashboardGreeting />

      {/* KPI row — zeros for now. Wired to real Firestore data in later phases. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value="0" icon={Briefcase} hint="Total tracked" />
        <StatCard label="Interviews" value="0" icon={CalendarClock} hint="Scheduled" />
        <StatCard label="Offers" value="0" icon={Trophy} hint="Received" />
        <StatCard label="Avg ATS score" value="—" icon={Gauge} hint="Analyze a resume" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity — empty state until we have data to show. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-muted-foreground text-xs">
                Upload a resume or add an application to get started.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link
              href="/resumes"
              className={buttonVariants({
                variant: "outline",
                className: "h-10 justify-start",
              })}
            >
              <FileText />
              Upload a resume
            </Link>
            <Link
              href="/applications"
              className={buttonVariants({
                variant: "outline",
                className: "h-10 justify-start",
              })}
            >
              <Plus />
              Add an application
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
