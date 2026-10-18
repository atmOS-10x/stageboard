import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from "react"
import { submitChangeRequest, useStageboard } from "stageboard/react"
import type { MapPage, Point, Region, SketchOp } from "stageboard"
import { ArrowUpIcon, CloseIcon, PenIcon, PointerIcon, SquareIcon, UndoIcon } from "./icons"

type Tool = "select" | "pen" | "arrow" | "block"
type View = { x: number; y: number; k: number }
export type MapFrame = MapPage & { frame: Region }
type Editing = { index: number; at: Point; value: string }

const KEY = "stageboard:sketch:map"
const INK = "#8d7af6"
const NOTE_COLORS = ["#fde68a", "#c7d2fe", "#bbf7d0", "#fecaca"]

function read(): SketchOp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]")
  } catch {
    return []
  }
}

function strokePath(points: Point[]): string {
  return points.length ? `M${points[0].x},${points[0].y}` + points.slice(1).map((p) => `L${p.x},${p.y}`).join("") : ""
}

function arrowPath(from: Point, to: Point, head: number): string {
  const a = Math.atan2(to.y - from.y, to.x - from.x)
  const p1 = { x: to.x - head * Math.cos(a - 0.45), y: to.y - head * Math.sin(a - 0.45) }
  const p2 = { x: to.x - head * Math.cos(a + 0.45), y: to.y - head * Math.sin(a + 0.45) }
  return `M${from.x},${from.y}L${to.x},${to.y}M${p1.x},${p1.y}L${to.x},${to.y}L${p2.x},${p2.y}`
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

function bounds(ops: SketchOp[]): Region {
  const pts: Point[] = []
  for (const op of ops) {
    if (op.type === "stroke") pts.push(...op.points)
    else if (op.type === "arrow") pts.push(op.from, op.to)
    else if (op.type === "block") pts.push({ x: op.rect.x, y: op.rect.y }, { x: op.rect.x + op.rect.width, y: op.rect.y + op.rect.height })
  }
  const real = pts
  if (!real.length) return { x: 0, y: 0, width: 1, height: 1 }
  const x = Math.min(...real.map((p) => p.x))
  const y = Math.min(...real.map((p) => p.y))
  return { x, y, width: Math.max(...real.map((p) => p.x)) - x || 1, height: Math.max(...real.map((p) => p.y)) - y || 1 }
}

export function useMapSketch({
  host,
  view,
  frames,
  active,
  onExit,
}: {
  host: RefObject<HTMLDivElement | null>
  view: View
  frames: MapFrame[]
  active: boolean
  onExit: () => void
}) {
  const [ops, setOps] = useState<SketchOp[]>(read)
  const opsRef = useRef(ops)
  opsRef.current = ops
  const history = useRef<SketchOp[][]>([])
  const [tool, setTool] = useState<Tool>("pen")
  const [selected, setSelected] = useState<number>()
  const [editing, setEditing] = useState<Editing>()
  const [composing, setComposing] = useState(false)
  const [hoverFrame, setHoverFrame] = useState<string>()
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    const t = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(ops)), 250)
    return () => clearTimeout(t)
  }, [ops])

  const remember = () => {
    history.current = [...history.current.slice(-80), opsRef.current]
  }
  const commit = (next: SketchOp[]) => {
    remember()
    setOps(next)
  }
  const undo = () => {
    const prev = history.current.pop()
    if (prev) setOps(prev)
    setSelected(undefined)
  }

  const world = useCallback(
    (clientX: number, clientY: number): Point => {
      const r = host.current!.getBoundingClientRect()
      const v = viewRef.current
      return { x: Math.round((clientX - r.left - v.x) / v.k), y: Math.round((clientY - r.top - v.y) / v.k) }
    },
    [host],
  )
  const frameAt = (p: Point) => frames.find((f) => p.x >= f.frame.x && p.x <= f.frame.x + f.frame.width && p.y >= f.frame.y && p.y <= f.frame.y + f.frame.height)

  const hit = (p: Point): number => {
    const tol = 8 / viewRef.current.k
    for (let i = opsRef.current.length - 1; i >= 0; i--) {
      const op = opsRef.current[i]
      if (op.type === "block") {
        const r = op.rect
        if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) return i
      } else if (op.type === "arrow") {
        if (distToSegment(p, op.from, op.to) < tol) return i
      } else if (op.type === "stroke") {
        for (let j = 1; j < op.points.length; j++) if (distToSegment(p, op.points[j - 1], op.points[j]) < tol) return i
      }
    }
    return -1
  }

  const track = (move: (ev: PointerEvent) => void, up: (ev: PointerEvent) => void) => {
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", end)
      up(ev)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", end)
  }

  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    setComposing(false)
    const p = world(e.clientX, e.clientY)
    const k = viewRef.current.k
    if (tool === "pen") {
      remember()
      const index = opsRef.current.length
      setOps((cur) => [...cur, { type: "stroke", points: [p], color: INK, width: Math.max(1, 3 / k) }])
      let last = p
      track(
        (ev) => {
          const q = world(ev.clientX, ev.clientY)
          if (Math.hypot(q.x - last.x, q.y - last.y) < 2 / k) return
          last = q
          setOps((cur) => cur.map((o, i) => (i === index && o.type === "stroke" ? { ...o, points: [...o.points, q] } : o)))
        },
        () => {},
      )
      return
    }
    if (tool === "arrow") {
      remember()
      const index = opsRef.current.length
      const fromStory = frameAt(p)?.storyId
      setOps((cur) => [...cur, { type: "arrow", from: p, to: p, color: INK, width: Math.max(1.5, 3 / k), fromStory }])
      track(
        (ev) => {
          const q = world(ev.clientX, ev.clientY)
          setHoverFrame(frameAt(q)?.storyId)
          setOps((cur) => cur.map((o, i) => (i === index && o.type === "arrow" ? { ...o, to: q } : o)))
        },
        (ev) => {
          setHoverFrame(undefined)
          const q = world(ev.clientX, ev.clientY)
          if (Math.hypot(q.x - p.x, q.y - p.y) < 12 / k) {
            setOps((cur) => cur.filter((_, i) => i !== index))
            return
          }
          const toStory = frameAt(q)?.storyId
          setOps((cur) => cur.map((o, i) => (i === index && o.type === "arrow" ? { ...o, to: q, toStory } : o)))
          setEditing({ index, at: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, value: "" })
        },
      )
      return
    }
    if (tool === "block") {
      remember()
      const index = opsRef.current.length
      const color = NOTE_COLORS[opsRef.current.filter((o) => o.type === "block").length % NOTE_COLORS.length]
      setOps((cur) => [...cur, { type: "block", rect: { x: p.x, y: p.y, width: 1, height: 1 }, color }])
      track(
        (ev) => {
          const q = world(ev.clientX, ev.clientY)
          const rect = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), height: Math.abs(q.y - p.y) }
          setOps((cur) => cur.map((o, i) => (i === index && o.type === "block" ? { ...o, rect } : o)))
        },
        () => {
          let at = p
          setOps((cur) =>
            cur.map((o, i) => {
              if (i !== index || o.type !== "block") return o
              const small = o.rect.width < 20 / k || o.rect.height < 20 / k
              const rect = small ? { x: p.x, y: p.y, width: 220, height: 120 } : o.rect
              at = { x: rect.x + 10, y: rect.y + 10 }
              return { ...o, rect }
            }),
          )
          setSelected(index)
          setEditing({ index, at, value: "" })
        },
      )
      return
    }
    const i = hit(p)
    setSelected(i >= 0 ? i : undefined)
    const op = opsRef.current[i]
    if (op?.type !== "block") return
    const base = op.rect
    let moved = false
    track(
      (ev) => {
        const q = world(ev.clientX, ev.clientY)
        if (!moved) remember()
        moved = true
        setOps((cur) => cur.map((o, j) => (j === i && o.type === "block" ? { ...o, rect: { ...base, x: base.x + q.x - p.x, y: base.y + q.y - p.y } } : o)))
      },
      () => {},
    )
  }

  const onDoubleClick = (e: { clientX: number; clientY: number }) => {
    const p = world(e.clientX, e.clientY)
    const i = hit(p)
    const op = opsRef.current[i]
    if (op?.type === "block") setEditing({ index: i, at: { x: op.rect.x + 10, y: op.rect.y + 10 }, value: op.label ?? "" })
    if (op?.type === "arrow") setEditing({ index: i, at: { x: (op.from.x + op.to.x) / 2, y: (op.from.y + op.to.y) / 2 }, value: op.label ?? "" })
  }

  const finishEdit = (save: boolean) => {
    const ed = editing
    setEditing(undefined)
    if (!ed || !save) return
    setOps((cur) => cur.map((o, i) => (i === ed.index && (o.type === "block" || o.type === "arrow") ? { ...o, label: ed.value.trim() || undefined } : o)))
  }

  const removeSelected = () => {
    if (selected === undefined) return
    commit(opsRef.current.filter((_, i) => i !== selected))
    setSelected(undefined)
  }

  const state = useRef({ undo, removeSelected, selected, editing, composing })
  state.current = { undo, removeSelected, selected, editing, composing }
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (state.current.editing || /^(INPUT|TEXTAREA)$/.test(t.tagName)) return
      const s = state.current
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        s.undo()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "v") setTool("select")
      else if (e.key === "p") setTool("pen")
      else if (e.key === "l") setTool("arrow")
      else if (e.key === "b") setTool("block")
      else if (e.key === "Backspace" || e.key === "Delete") s.removeSelected()
      else if (e.key === "Enter") setComposing(opsRef.current.length > 0)
      else if (e.key === "Escape") {
        if (s.composing) setComposing(false)
        else if (s.selected !== undefined) setSelected(undefined)
        else onExit()
      } else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [active, onExit])

  const clear = () => {
    commit([])
    setSelected(undefined)
    setComposing(false)
  }

  return { ops, tool, setTool, selected, editing, setEditing, finishEdit, composing, setComposing, hoverFrame, onPointerDown, onDoubleClick, undo, clear, canUndo: history.current.length > 0, frames }
}

type MapSketchState = ReturnType<typeof useMapSketch>

export function MapSketchWorld({ s, k, active }: { s: MapSketchState; k: number; active: boolean }) {
  const head = Math.max(10, 14 / k)
  return (
    <>
      {s.hoverFrame && (() => {
        const f = s.frames.find((x) => x.storyId === s.hoverFrame)
        return f ? <div className="sbu-msk-target" style={{ left: f.frame.x, top: f.frame.y, width: f.frame.width, height: f.frame.height }} /> : null
      })()}
      <svg className="sbu-msk-svg" width="1" height="1" data-active={active}>
        {s.ops.map((op, i) =>
          op.type === "stroke" ? (
            <path key={i} d={strokePath(op.points)} stroke={op.color} strokeWidth={op.width} data-selected={s.selected === i} />
          ) : op.type === "arrow" ? (
            <path key={i} d={arrowPath(op.from, op.to, head)} stroke={op.color} strokeWidth={op.width ?? 3} data-selected={s.selected === i} />
          ) : null,
        )}
      </svg>
      {s.ops.map((op, i) =>
        op.type === "block" ? (
          <div key={i} className="sbu-msk-note" data-selected={s.selected === i} style={{ left: op.rect.x, top: op.rect.y, width: op.rect.width, height: op.rect.height, background: op.color }}>
            {op.label}
          </div>
        ) : op.type === "arrow" && op.label ? (
          <div key={i} className="sbu-msk-label" style={{ left: (op.from.x + op.to.x) / 2, top: (op.from.y + op.to.y) / 2, fontSize: Math.max(12, 13 / k) }}>
            {op.label}
          </div>
        ) : null,
      )}
      {s.editing && (
        <input
          className="sbu-msk-edit"
          style={{ left: s.editing.at.x, top: s.editing.at.y, fontSize: Math.max(13, 14 / k), height: Math.max(26, 28 / k), width: Math.max(180, 220 / k) }}
          placeholder={s.ops[s.editing.index]?.type === "arrow" ? "Label (optional)" : "Note"}
          value={s.editing.value}
          autoFocus
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => s.setEditing({ ...s.editing!, value: e.target.value })}
          onBlur={() => s.finishEdit(true)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "Enter") s.finishEdit(true)
            if (e.key === "Escape") s.finishEdit(false)
          }}
        />
      )}
    </>
  )
}

export function MapSketchScreen({ s, onExit }: { s: MapSketchState; onExit: () => void }) {
  const connected = useStageboard((st) => st.connected)
  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()

  const send = async () => {
    if (!s.ops.length || sending) return
    setSending(true)
    setError(undefined)
    try {
      const pages: MapPage[] = s.frames.map(({ frame: _f, ...page }) => page)
      const touched = pages.find((g) => s.ops.some((op) => op.type === "arrow" && (op.fromStory === g.storyId || op.toStory === g.storyId)))
      const rect = bounds(s.ops)
      await submitChangeRequest({
        kind: "edit",
        note: note.trim() || "Change the app as I sketched it on the site map.",
        target: { url: "", title: "Site map", selector: "", tag: "map", rect, viewport: { width: 1440, height: 900 }, components: [], storyId: touched?.storyId },
        map: { ops: s.ops, pages },
      })
      setNote("")
      s.clear()
      onExit()
    } catch (e) {
      setError((e as Error).message.replace(/^\d+\s*/, ""))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="sbu-msk-catch" data-tool={s.tool} onPointerDown={s.onPointerDown} onDoubleClick={s.onDoubleClick} />
      {s.composing && (
        <div className="sbu-msk-compose" onPointerDown={(e) => e.stopPropagation()}>
          <textarea
            autoFocus
            className="sbu-dream-prompt"
            placeholder={`${s.ops.length} mark${s.ops.length === 1 ? "" : "s"} on the site map · anything to add? (optional)`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Escape") s.setComposing(false)
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send()
              }
            }}
            aria-label="Note for the agent"
          />
          {error && <div className="sbu-composer-error">{error}</div>}
          {!connected && <div className="sbu-composer-error">Bridge offline · start it with stageboard dev</div>}
          <div className="sbu-dream-bar">
            <span className="sbu-dim">Arrows become navigation, notes become instructions</span>
            <span className="sbu-spacer" />
            <button type="button" className="sbu-send" disabled={sending || !connected} onClick={() => void send()} aria-label="Send to the agent">
              {sending ? <span className="sbu-spin" /> : <ArrowUpIcon size={14} />}
            </button>
          </div>
        </div>
      )}
      <div className="sbu-sketch-bar" role="toolbar" aria-label="Site map sketch tools" onPointerDown={(e) => e.stopPropagation()}>
        <Tool on={s.tool === "select"} onClick={() => s.setTool("select")} label="Select and move · V · Backspace deletes">
          <PointerIcon size={15} />
        </Tool>
        <Tool on={s.tool === "pen"} onClick={() => s.setTool("pen")} label="Draw · P">
          <PenIcon size={15} />
        </Tool>
        <Tool on={s.tool === "arrow"} onClick={() => s.setTool("arrow")} label="Arrow between screens · L">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 13L13 3M7 3h6v6" />
          </svg>
        </Tool>
        <Tool on={s.tool === "block"} onClick={() => s.setTool("block")} label="Note · B">
          <SquareIcon size={15} />
        </Tool>
        <span className="sbu-sketch-sep" />
        <Tool on={false} onClick={s.undo} label="Undo · ⌘Z" disabled={!s.canUndo}>
          <UndoIcon size={15} />
        </Tool>
        <Tool on={false} onClick={s.clear} label="Clear the sketch" disabled={!s.ops.length}>
          <CloseIcon size={13} />
        </Tool>
        <span className="sbu-sketch-count sbu-tnum">{s.ops.length ? `${s.ops.length} mark${s.ops.length === 1 ? "" : "s"}` : "Draw, link screens with arrows, leave notes"}</span>
        <button type="button" className="sbu-sketch-go" disabled={!s.ops.length} onClick={() => s.setComposing(true)} title="Send the sketch to the agent · Enter">
          Reconcile <ArrowUpIcon size={13} />
        </button>
      </div>
    </>
  )
}

function Tool({ on, onClick, label, disabled, children }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className="sbu-sketch-tool" data-on={on} aria-pressed={on} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
