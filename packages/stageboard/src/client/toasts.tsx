import { useEffect, useRef, useSyncExternalStore } from "react"
import { createFlow, updateDream, updateFlow, useStageboard } from "@atmos.build/stageboard/react"
import type { Job } from "@atmos.build/stageboard"
import { AlertIcon, CloseIcon } from "./icons"
import { Button, IconButton } from "./kit"

type Action = { label: string; run: () => void }
export type Toast = { id: string; tone: "error" | "info"; title: string; body?: string; actions?: Action[] }

let toasts: Toast[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function pushToast(toast: Omit<Toast, "id"> & { id?: string }) {
  const id = toast.id ?? Math.random().toString(36).slice(2)
  toasts = [...toasts.filter((t) => t.id !== id), { ...toast, id }].slice(-4)
  emit()
  if (toast.tone === "info") setTimeout(() => dismissToast(id), 5000)
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message.replace(/^\d+\s*/, "").replace(/^\{"error":"(.*)"\}$/, "$1") : String(e)
}

function jobTitle(job: Job, flowName?: string): string {
  if (job.kind === "flow") return job.flow ? `Assembling “${flowName ?? "flow"}” didn’t finish` : "Suggesting flows didn’t finish"
  if (job.kind === "page") return "Building a new screen didn’t finish"
  if (job.kind === "variants") return "Variants didn’t finish"
  return "The agent didn’t finish"
}

// Toasts once for every job that fails while stageboard is open, with the agent's error and a way to retry.
export function useJobToasts() {
  const jobs = useStageboard((s) => s.jobs)
  const flows = useStageboard((s) => s.flows)
  const connected = useStageboard((s) => s.connected)
  const seen = useRef<Map<string, Job["status"]> | undefined>(undefined)
  useEffect(() => {
    if (!connected) return
    if (!seen.current) {
      seen.current = new Map(jobs.map((j) => [j.id, j.status]))
      return
    }
    for (const job of jobs) {
      const before = seen.current.get(job.id)
      seen.current.set(job.id, job.status)
      if (job.status !== "failed" || before === "failed") continue
      const flow = job.flow ? flows.find((f) => f.id === job.flow) : undefined
      const actions: Action[] = [{ label: "Copy log", run: () => void navigator.clipboard?.writeText([job.error, "", ...job.log].filter((l) => l !== undefined).join("\n")) }]
      if (job.kind === "flow" && !job.flow) actions.unshift({ label: "Try again", run: () => void createFlow({ suggest: true }).catch((e) => pushToast({ tone: "error", title: "Couldn’t start the agent", body: errorText(e) })) })
      if (flow?.description) actions.unshift({ label: "Try again", run: () => void updateFlow(flow.id, { retry: true }) })
      if (job.dream) actions.unshift({ label: "Try again", run: () => void updateDream(job.dream!, { retry: true }) })
      pushToast({ id: `job-${job.id}`, tone: "error", title: jobTitle(job, flow?.name), body: job.error ?? "The agent stopped without saying why.", actions })
    }
  }, [jobs, flows, connected])
}

export function Toasts() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
  )
  if (!list.length) return null
  return (
    <div className="sbu-toasts" role="region" aria-label="Notifications">
      {list.map((t) => (
        <div key={t.id} className="sbu-toast sbu-panel" data-tone={t.tone} role={t.tone === "error" ? "alert" : "status"}>
          {t.tone === "error" && <AlertIcon size={14} />}
          <div className="sbu-toast-text">
            <div className="sbu-toast-title">{t.title}</div>
            {t.body && <div className="sbu-toast-body">{t.body}</div>}
            {t.actions && (
              <div className="sbu-toast-actions">
                {t.actions.map((a) => (
                  <Button
                    key={a.label}
                    size="sm"
                    onClick={() => {
                      a.run()
                      if (a.label !== "Copy log") dismissToast(t.id)
                    }}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <IconButton size="sm" variant="ghost" icon={<CloseIcon size={14} />} label="Dismiss" onClick={() => dismissToast(t.id)} />
        </div>
      ))}
    </div>
  )
}
