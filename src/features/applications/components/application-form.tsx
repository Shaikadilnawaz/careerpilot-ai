"use client"

/**
 * ApplicationForm — add a job to the tracker.
 *
 * Collapsed to a single button until you need it. A tracker competes with a
 * spreadsheet, and the only thing that makes people switch is speed: company +
 * role + Save, in about five seconds. Everything else is optional and can be
 * filled in later.
 */
import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Loader2, X, FileText } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth/auth-context"
import type { Resume } from "@/features/resumes/schema"
import { subscribeToResumes } from "@/features/resumes/services/resume-service"

import {
  APPLICATION_STATUSES,
  STATUS_LABEL,
  applicationInputSchema,
  type ApplicationInput,
} from "../schema"
import { createApplication } from "../services/application-service"

export function ApplicationForm() {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [resumes, setResumes] = React.useState<Resume[]>([])

  const form = useForm<ApplicationInput>({
    resolver: zodResolver(applicationInputSchema),
    defaultValues: {
      company: "",
      role: "",
      jobUrl: "",
      status: "saved",
      resumeId: "",
      jobDescription: "",
      notes: "",
    },
  })

  // Reuse the Week 2 live listener so the resume picker is always current.
  React.useEffect(() => {
    if (!user || !open) return
    const unsubscribe = subscribeToResumes(
      user.uid,
      setResumes,
      (error) => console.error(error)
    )
    return () => unsubscribe()
  }, [user, open])

  async function onSubmit(values: ApplicationInput) {
    if (!user) return
    try {
      // Look up the filename NOW so the list can render without extra reads.
      const linked = resumes.find((r) => r.id === values.resumeId)

      await createApplication(user.uid, {
        company: values.company,
        role: values.role,
        jobUrl: values.jobUrl ?? "",
        status: values.status,
        resumeId: values.resumeId ?? "",
        resumeFileName: linked?.fileName ?? "",
        analysisId: "",
        jobDescription: values.jobDescription ?? "",
        notes: values.notes ?? "",
      })

      toast.success(`${values.company} added.`)
      form.reset()
      setOpen(false)
    } catch (error) {
      console.error(error)
      toast.error("Could not save this application.")
    }
  }

  const { isSubmitting } = form.formState

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="self-start">
        <Plus /> Add application
      </Button>
    )
  }

  return (
    <Card>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">New application</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel"
                onClick={() => {
                  form.reset()
                  setOpen(false)
                }}
              >
                <X />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc." className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Frontend Engineer"
                        className="h-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="jobUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Job link{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://…"
                      className="h-9"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status: a button group beats a <select> for 5 fixed options —
                every choice is visible, and it's one tap on mobile. */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {APPLICATION_STATUSES.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={field.value === status ? "default" : "outline"}
                        onClick={() => field.onChange(status)}
                      >
                        {STATUS_LABEL[status]}
                      </Button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {resumes.length > 0 && (
              <FormField
                control={form.control}
                name="resumeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Resume sent{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <div className="flex flex-col gap-1.5">
                      {resumes.map((resume) => (
                        <button
                          key={resume.id}
                          type="button"
                          // Click the selected one again to unlink it.
                          onClick={() =>
                            field.onChange(
                              field.value === resume.id ? "" : resume.id
                            )
                          }
                          aria-pressed={field.value === resume.id}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            field.value === resume.id
                              ? "border-ring bg-muted/60"
                              : "border-border hover:bg-muted/40"
                          )}
                        >
                          <FileText className="text-muted-foreground size-4 shrink-0" />
                          <span className="truncate">{resume.fileName}</span>
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Job description{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional — reused when tailoring)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Paste the posting so you don't have to find it again."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Notes{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Referral from Sam, recruiter call on Tuesday…"
                      className="min-h-16"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              {/* isSubmitting is tracked by react-hook-form automatically —
                  no manual loading state needed. */}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Save application
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
