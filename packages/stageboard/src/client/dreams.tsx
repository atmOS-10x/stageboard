import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react"
import { createDream, removeDream, updateDream } from "stageboard/react"
import type { Dream } from "stageboard"
import { ArrowUpIcon, CloseIcon } from "./icons"
import { WaveCanvas } from "./waves"

export type Pos = { x: number; y: number }

const REVEALS = "stageboard:dream-reveals"

export function pendingReveals(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(REVEALS) ?? "[]")
  } catch {
    return []
  }
}

export function markReveal(id: string, on: boolean) {
  const list = pendingReveals().filter((x) => x !== id)
  sessionStorage.setItem(REVEALS, JSON.stringify(on ? [...list, id] : list))
}

export function DreamCard({
  parent,
  parentUrl,
  position,
  width,
  bodyHeight,
  headHeight,
  onClose,
}: {
  parent?: string
  parentUrl?: string
  position: Pos
  width: number
  bodyHeight: number
  headHeight: number
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()
  const promptRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    promptRef.current?.focus({ preventScroll: true })
  }, [])

  const send = async () => {
    if (!prompt.trim() || sending) return
    setSending(true)
    setError(undefined)
    try {
      const dream = await createDream({ name, prompt, parent, parentUrl, position })
      markReveal(dream.id, true)
      onClose()
    } catch (e) {
      setSending(false)
      setError((e as Error).message.replace(/^\d+\s*/, ""))
    }
  }

  return (
    <div
      className="sbu-node sbu-dream"
      data-pending="true"
      style={{ left: position.x, top: position.y, width, height: bodyHeight + headHeight }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape") onClose()
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          void send()
        }
      }}
    >
      <div className="sbu-node-head" style={{ height: headHeight }}>
        <input className="sbu-dream-name" placeholder="New page" value={name} onChange={(e) => setName(e.target.value)} aria-label="Page name (optional)" />
        <button type="button" className="sbu-icon" onClick={onClose} aria-label="Cancel">
          <CloseIcon size={12} />
        </button>
      </div>
      <div className="sbu-dream-body" style={{ height: bodyHeight }}>
        <WaveCanvas mode="render" />
        <div className="sbu-dream-card">
          <textarea
            ref={promptRef}
            className="sbu-dream-prompt"
            placeholder="What should this page be?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={sending}
            aria-label="Describe the new page"
          />
          {error && <div className="sbu-composer-error">{error}</div>}
          <div className="sbu-dream-bar">
            <span className="sbu-dim">The agent builds the page and its story</span>
            <span className="sbu-spacer" />
            <button type="button" className="sbu-send" disabled={!prompt.trim() || sending} onClick={() => void send()} aria-label="Create page">
              {sending ? <span className="sbu-spin" /> : <ArrowUpIcon size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DreamNode({
  dream,
  position,
  width,
  bodyHeight,
  headHeight,
  zoom,
  underlay,
  onMove,
}: {
  dream: Dream
  position: Pos
  width: number
  bodyHeight: number
  headHeight: number
  zoom: number
  underlay?: string
  onMove: (pos: Pos) => void
}) {
  const failed = dream.status === "failed"
  const started = new Date(dream.createdAt).getTime()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (failed) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [failed])
  const secs = Math.max(0, Math.round((now - started) / 1000))

  const drag = (e: RPointerEvent) => {
    if ((e.target as Element).closest("button")) return
    e.stopPropagation()
    const start = { x: e.clientX, y: e.clientY, p: position }
    let last = position
    const move = (ev: PointerEvent) => {
      last = { x: start.p.x + (ev.clientX - start.x) / zoom, y: start.p.y + (ev.clientY - start.y) / zoom }
      onMove(last)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      if (last !== position) void updateDream(dream.id, { position: last })
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <div className="sbu-node sbu-dream" data-failed={failed} style={{ left: position.x, top: position.y, width, height: bodyHeight + headHeight }}>
      <div className="sbu-node-head" style={{ height: headHeight }} onPointerDown={drag} title={dream.prompt}>
        <span className="sbu-node-route">{failed ? "didn’t finish" : "rendering"}</span>
        <span className="sbu-node-title">{dream.name ?? dream.prompt}</span>
        <button type="button" className="sbu-icon" onClick={() => void removeDream(dream.id)} aria-label="Remove this page">
          <CloseIcon size={12} />
        </button>
      </div>
      <div className="sbu-dream-body" style={{ height: bodyHeight }}>
        <WaveCanvas mode="render" underlay={underlay} />
        <div className="sbu-dream-status" role="status">
          {failed ? (
            <>
              <span>The agent didn’t finish this page</span>
              <button type="button" className="sbu-ghost" onClick={() => void updateDream(dream.id, { retry: true })}>
                Try again
              </button>
            </>
          ) : (
            <span className="sbu-tnum">
              Rendering · {secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, "0")}s`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
