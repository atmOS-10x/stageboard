import { useMemo, useState } from "react"
import { ORIGINAL, type ElementTarget, type Job } from "../../core/protocol"
import {
  cancelJob,
  isActiveJob,
  selectedKey,
  selectVariant,
  submitChangeRequest,
  useStageboard,
} from "../store"

type Mode = "variants" | "edit"

export function Panel({
  target,
  onClose,
  docked = true,
}: {
  target: ElementTarget
  onClose?: () => void
  docked?: boolean
}) {
  const [focus, setFocus] = useState(0)
  const [note, setNote] = useState("")
  const [mode, setMode] = useState<Mode>("edit")
  const [count, setCount] = useState(3)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()

  const connected = useStageboard((s) => s.connected)
  const variantId = target.variantId
  const serverVariants = useStageboard((s) => s.serverVariants)
  const localVariants = useStageboard((s) => (variantId ? s.registry[variantId] : undefined))
  const options = useMemo(() => {
    const fromServer = serverVariants.filter((v) => v.of === variantId)
    return fromServer.length ? fromServer : (localVariants ?? [])
  }, [serverVariants, localVariants, variantId])
  const active = useStageboard((s) => (variantId ? selectedKey(s, variantId) : ORIGINAL))
  const allJobs = useStageboard((s) => s.jobs)
  const jobs = useMemo(
    () =>
      allJobs
        .filter((j) => (variantId ? j.variantId === variantId : j.target.selector === target.selector))
        .slice(-5)
        .reverse(),
    [allJobs, variantId, target.selector],
  )
  const pending = jobs.filter((j) => isActiveJob(j) && j.kind === "variants")
  const pendingSlots = pending.reduce((n, j) => n + Math.max(0, j.count - j.producedFiles.length), 0)
  const adopting = jobs.some((j) => isActiveJob(j) && j.kind === "adopt")
  const canAdopt = active !== ORIGINAL && options.some((v) => v.key === active)

  const components = target.components
  const focused = components[focus]

  async function send() {
    if (!note.trim()) return
    setSending(true)
    setError(undefined)
    try {
      const focusedTarget: ElementTarget = {
        ...target,
        components: components.slice(focus),
      }
      await submitChangeRequest({ kind: mode, note: note.trim(), count: mode === "variants" ? count : 1, target: focusedTarget })
      setNote("")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  async function adopt() {
    if (!variantId) return
    setError(undefined)
    try {
      await submitChangeRequest({ kind: "adopt", note: "", adoptKey: active, target: { ...target, variantKeys: { ...target.variantKeys, [variantId]: active } } })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="sb-panel" data-docked={docked}>
      <div className="sb-sec">
        <div className="sb-title">
          <span>{focused ? `<${focused.name}>` : `<${target.tag}>`}</span>
          {onClose && (
            <button className="sb-icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        {focused?.source && (
          <div className="sb-sub sb-mono">
            {focused.source.file}
            {focused.source.line ? `:${focused.source.line}` : ""}
          </div>
        )}
        {components.length > 1 && (
          <div className="sb-crumbs" aria-label="Component chain">
            {components.map((c, i) => (
              <button key={`${c.name}-${i}`} className="sb-crumb" data-on={i === focus} onClick={() => setFocus(i)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sb-scroll">
        {variantId && (
          <div className="sb-sec">
            <div className="sb-h">
              <span>Variants</span>
              <span className="sb-mono" style={{ textTransform: "none", letterSpacing: 0 }}>
                {variantId}
              </span>
            </div>
            <div className="sb-variants">
              <VariantOption label="Original" description="The committed version" on={active === ORIGINAL} onClick={() => selectVariant(variantId, ORIGINAL)} />
              {options.map((v) => (
                <VariantOption key={v.key} label={v.label} description={v.description} on={active === v.key} onClick={() => selectVariant(variantId, v.key)} />
              ))}
              {Array.from({ length: pendingSlots }).map((_, i) => (
                <div key={`p${i}`} className="sb-variant" data-pending="true">
                  <span className="sb-spinner" />
                  <span>
                    <span className="sb-vl">Generating…</span>
                  </span>
                </div>
              ))}
            </div>
            {canAdopt && (
              <button className="sb-btn" style={{ marginTop: 8 }} disabled={adopting} onClick={() => void adopt()}>
                {adopting ? "Adopting…" : "Adopt as original"}
              </button>
            )}
          </div>
        )}

        <div className="sb-sec">
          <div className="sb-h">
            <span>Ask the agent</span>
            <span className="sb-dot" data-on={connected} title={connected ? "Bridge connected" : "Bridge offline"} />
          </div>
          <textarea
            className="sb-textarea"
            placeholder={mode === "variants" ? "e.g. calmer, more editorial, less gradient" : "Describe the change"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send()
              e.stopPropagation()
            }}
          />
          <div className="sb-row">
            <div className="sb-seg">
              <button data-on={mode === "edit"} onClick={() => setMode("edit")}>
                Edit
              </button>
              <button data-on={mode === "variants"} onClick={() => setMode("variants")}>
                Variants
              </button>
            </div>
            {mode === "variants" && (
              <div className="sb-seg" aria-label="Number of variants">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} data-on={count === n} onClick={() => setCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            <button className="sb-btn" disabled={!note.trim() || sending || !connected} onClick={send}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          {!connected && <div className="sb-note" style={{ marginTop: 8 }}>Bridge offline. Start it with <span className="sb-mono">stageboard dev</span>.</div>}
          {error && <div className="sb-note" style={{ marginTop: 8, color: "var(--sb-err)" }}>{error}</div>}
        </div>

        {jobs.length > 0 && (
          <div className="sb-sec">
            <div className="sb-h">Agents</div>
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VariantOption({ label, description, on, onClick }: { label: string; description?: string; on: boolean; onClick: () => void }) {
  return (
    <button className="sb-variant" data-on={on} onClick={onClick}>
      <span className="sb-radio" />
      <span>
        <span className="sb-vl">{label}</span>
        {description && <div className="sb-vd">{description}</div>}
      </span>
    </button>
  )
}

function JobRow({ job }: { job: Job }) {
  return (
    <div className="sb-job-row">
      {isActiveJob(job) ? <span className="sb-spinner" /> : null}
      <span className="sb-status" data-s={job.status}>
        {job.status}
      </span>
      <span className="sb-ellipsis" title={job.note}>
        {job.note}
      </span>
      {job.externalUrl && (
        <a className="sb-link" href={job.externalUrl} target="_blank" rel="noreferrer">
          open
        </a>
      )}
      {isActiveJob(job) && (
        <button className="sb-btn-ghost" onClick={() => cancelJob(job.id)}>
          Stop
        </button>
      )}
    </div>
  )
}
