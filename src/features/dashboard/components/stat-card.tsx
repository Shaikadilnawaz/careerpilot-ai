import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type StatCardProps = {
  label: string
  value: string
  icon: LucideIcon
  hint?: string
}

/**
 * A single KPI tile (Applications, Interviews, etc.). Pure presentational
 * Server Component — hand it a label + value and it renders. We'll feed it real
 * numbers once the tracker and resume features exist.
 */
export function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        {/* CardAction auto-positions to the top-right of the card grid. */}
        <CardAction>
          <Icon className="text-muted-foreground size-4" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="text-foreground text-2xl font-semibold">{value}</div>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  )
}
