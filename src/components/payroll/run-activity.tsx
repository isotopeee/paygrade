"use client"

import { useState } from "react"
import { ArrowRightIcon, MessageSquareIcon, SendIcon, Undo2Icon } from "lucide-react"

import type { PayrollRun, RunComment } from "@/types"
import { ROLE_LABELS, RUN_STATUS_LABELS } from "@/lib/constants"
import { formatDateTime, initials } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useDataStore } from "@/stores/data-store"
import { useCurrentUser } from "@/stores/session-store"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

function describe(c: RunComment): React.ReactNode {
  if (c.kind === "return") {
    return (
      <>
        returned the run from <strong className="font-medium">{RUN_STATUS_LABELS[c.fromStatus ?? "draft"]}</strong> to{" "}
        <strong className="font-medium">{RUN_STATUS_LABELS[c.toStatus ?? "draft"]}</strong>
      </>
    )
  }
  if (c.kind === "transition") {
    return (
      <>
        moved the run to <strong className="font-medium">{RUN_STATUS_LABELS[c.toStatus ?? "draft"]}</strong>
      </>
    )
  }
  return "commented"
}

export function RunActivity({ run }: { run: PayrollRun }) {
  const addComment = useDataStore((s) => s.addComment)
  const user = useCurrentUser()
  const [body, setBody] = useState("")
  const items = [...run.comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    addComment(run.id, body.trim())
    setBody("")
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-border">
        <li className="relative flex gap-3">
          <span className="z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </span>
          <div className="pt-1 text-sm">
            <span className="font-medium">{run.createdBy}</span> created the run
            <div className="text-xs text-muted-foreground tabular-nums">{formatDateTime(run.createdAt)}</div>
          </div>
        </li>
        {items.map((c) => (
          <li key={c.id} className="relative flex gap-3">
            {c.kind === "comment" ? (
              <Avatar size="sm" className="z-10 size-7">
                <AvatarFallback className="bg-muted text-[10px]">{initials(c.author)}</AvatarFallback>
              </Avatar>
            ) : (
              <span
                className={cn(
                  "z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background",
                  c.kind === "return" && "border-foreground bg-foreground text-background"
                )}
              >
                {c.kind === "return" ? (
                  <Undo2Icon className="size-3.5" aria-hidden />
                ) : (
                  <ArrowRightIcon className="size-3.5" aria-hidden />
                )}
              </span>
            )}
            <div className="min-w-0 flex-1 pt-1 text-sm">
              <div className="flex flex-wrap items-center gap-x-1.5">
                <span className="font-medium">{c.author}</span>
                <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                  {ROLE_LABELS[c.role]}
                </Badge>
                <span className="text-muted-foreground">{describe(c)}</span>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">{formatDateTime(c.createdAt)}</div>
              {c.body && (
                <p
                  className={cn(
                    "mt-2 rounded-lg border px-3 py-2 text-sm whitespace-pre-wrap",
                    c.kind === "return" ? "border-foreground" : "bg-muted/40"
                  )}
                >
                  {c.body}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={submit} className="space-y-2 self-start rounded-lg border p-3 lg:sticky lg:top-20">
        <Field>
          <FieldLabel htmlFor="run-comment" className="flex items-center gap-1.5">
            <MessageSquareIcon className="size-4" aria-hidden />
            Add a comment
          </FieldLabel>
          <Textarea
            id="run-comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Notes for the next reviewer, questions on specific employees, or references to supporting documents"
          />
        </Field>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            Posting as {user?.name}
          </span>
          <Button type="submit" size="sm" disabled={!body.trim()}>
            <SendIcon data-icon="inline-start" aria-hidden />
            Post
          </Button>
        </div>
      </form>
    </div>
  )
}
