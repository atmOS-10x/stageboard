import { useEffect, useRef, useState } from "react"
import { cancelJob } from "stageboard/react"
import type { Job } from "stageboard"
import { belowAnchor, isActive, useAnchored, useAnnotate, useOutsidePointer } from "./annotate"
import { uploadUrl } from "./api"
import { AlertIcon, CheckIcon, CloseIcon, ExternalIcon, LayersIcon } from "./icons"
import { Button, IconButton } from "./kit"

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

export function pinStatus(job: Job): { label: string; detail?: string } {
  const produced = job.producedFiles.length
  if (job.status === "queued") return { label: "Queued" }
  if (job.status === "running") {
    if (job.kind === "variants") return { label: "Sketching", detail: `${produced}/${job.count}` }
    if (job.kind === "adopt") return { label: "Adopting" }
    return { label: "Editing" }
  }
  if (job.status === "failed") return { label: "Didn’t finish" }
  if (job.status === "cancelled") return { label: "Stopped" }
  if (job.kind === "variants") return { label: plural(produced || job.count, "variant") }
  return { label: job.kind === "adopt" ? "Adopted" : "Edited" }
}

export function elapsed(job: Job, now = Date.now()): string {
  const end = isActive(job) ? now : new Date(job.updatedAt).getTime()
  const s = Math.max(0, Math.round((end - new Date(job.createdAt).getTime()) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

export function StatusGlyph({ job }: { job: Job }) {
  if (isActive(job)) return <span className="sbu-spin" aria-hidden="true" />
  if (job.status === "done") return <CheckIcon size={12} />
  if (job.status === "failed") return <AlertIcon size={12} />
  return <span className="sbu-pin-hollow" aria-hidden="true" />
}

export function Pin({
  job,
  open,
  onHover,
  onClick,
}: {
  job: Job
  open: boolean
  onHover: (on: boolean) => void
  onClick: (el: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const status = pinStatus(job)
  const active = isActive(job)
  const now = useNow(active)
  return (
    <button
      ref={ref}
      type="button"
      className="sbu-pin"
      data-status={job.status}
      data-open={open}
      title={job.note}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick(ref.current)
      }}
    >
      <StatusGlyph job={job} />
      <span>{status.label}</span>
      {status.detail && <span className="sbu-pin-dim">{status.detail}</span>}
      {active && <span className="sbu-pin-dim sbu-tnum">{elapsed(job, now)}</span>}
    </button>
  )
}

export function PinDetails({
  job,
  onClose,
  onDismiss,
  onShowVariants,
}: {
  job: Job
  onClose: () => void
  onDismiss: (id: string) => void
  onShowVariants?: () => void
}) {
  const { base, pinAnchor } = useAnnotate()
  const ref = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLPreElement>(null)
  const placement = useAnchored(pinAnchor, ref, belowAnchor(8))
  const active = isActive(job)
  const now = useNow(active)
  const status = pinStatus(job)
  const [stopping, setStopping] = useState(false)
  const tail = job.log.slice(-8).join("\n").trim()
  const images = [
    ...(job.selectionImage ? [{ id: "selection", url: uploadUrl(base, job.selectionImage), name: "Selection" }] : []),
    ...(job.attachments ?? []),
  ]

  useOutsidePointer(ref, (t) => {
    if (!t.closest(".sbu-pin")) onClose()
  })

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [tail])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", on, true)
    return () => window.removeEventListener("keydown", on, true)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="sbu-float sbu-details"
      data-placed={Boolean(placement)}
      style={placement ? { left: placement.left, top: placement.top, transformOrigin: placement.origin } : undefined}
      role="dialog"
      aria-label="Agent request"
    >
      <div className="sbu-details-head">
        <StatusGlyph job={job} />
        <span>{status.label}</span>
        {status.detail && <span className="sbu-dim">{status.detail}</span>}
        <span className="sbu-dim sbu-tnum">{elapsed(job, now)}</span>
        <span className="sbu-spacer" />
        <IconButton size="sm" variant="ghost" icon={<CloseIcon size={14} />} label="Close" onClick={onClose} />
      </div>
      <p className="sbu-details-note">{job.note}</p>
      {job.summary && <p className="sbu-details-note sbu-dim">{job.summary}</p>}
      {images.length > 0 && (
        <div className="sbu-chips-img">
          {images.map((img) => (
            <a key={img.id} className="sbu-imgchip" href={img.url} target="_blank" rel="noreferrer" title={img.name}>
              <img src={img.url} alt={img.name} />
            </a>
          ))}
        </div>
      )}
      {(tail || job.error) && (
        <pre ref={logRef} className="sbu-log">
          {job.error && !tail.includes(job.error) ? `${tail}\n${job.error}`.trim() : tail}
        </pre>
      )}
      <div className="sbu-details-foot">
        {job.externalUrl && (
          <Button size="sm" variant="ghost" icon={<ExternalIcon size={13} />} onClick={() => window.open(job.externalUrl, "_blank", "noreferrer")}>
            Open agent
          </Button>
        )}
        {!active && job.kind === "variants" && job.status === "done" && onShowVariants && (
          <Button size="sm" icon={<LayersIcon size={13} />} onClick={onShowVariants}>
            Show variants
          </Button>
        )}
        <span className="sbu-spacer" />
        {active ? (
          <Button
            size="sm"
            disabled={stopping}
            onClick={async () => {
              setStopping(true)
              await cancelJob(job.id).catch(() => {})
              setStopping(false)
            }}
          >
            {stopping ? "Stopping…" : "Stop"}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              onDismiss(job.id)
              onClose()
            }}
          >
            Dismiss
          </Button>
        )}
      </div>
    </div>
  )
}
