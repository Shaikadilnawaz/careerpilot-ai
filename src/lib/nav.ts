import {
  LayoutDashboard,
  FileText,
  Sparkles,
  Briefcase,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

// Central nav config — the single source used by BOTH the desktop sidebar and
// the mobile drawer, so the two can never drift apart. Add a route here and it
// appears in both places automatically.
export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Resumes", href: "/resumes", icon: FileText },
  { label: "Analyze", href: "/analyze", icon: Sparkles },
  { label: "Applications", href: "/applications", icon: Briefcase },
]
