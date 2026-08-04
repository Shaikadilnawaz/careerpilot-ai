import { AuthGuard } from "@/features/auth/components/auth-guard"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppTopbar } from "@/components/layout/app-topbar"

/**
 * Shared shell for every protected page. AuthGuard blocks logged-out users;
 * inside it, the persistent sidebar + topbar frame the page content. Because
 * this is the (dashboard) route group's layout, ALL of /dashboard, /resumes,
 * /applications get this shell for free.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  )
}
