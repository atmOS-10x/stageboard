import { useCallback, useEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent as RWheelEvent } from "react"
import { createPortal } from "react-dom"
import type { SketchApi, SketchTarget } from "stageboard/react"
import type { Region, Sketch, SketchOp } from "stageboard"
import { useScrollSync, type Surface } from "./annotate"
import { CloseIcon, ComponentIcon, PenIcon, PointerIcon, SquareIcon, UndoIcon } from "./icons"
import { Button, IconButton, Input } from "./kit"
import { Thumb } from "./thumb"
import type { ClientEntry } from "./types"

type Tool = "select" | "pen" | "block"
type Selection = { kind: "el"; target: SketchTarget } | { kind: "op"; index: number }
type Editing = { selector?: string; index?: number; rect: Region; value: string; before: string }
type Corner = "nw" | "ne" | "sw" | "se"

const KEY = (id: string) => `stageboard:sketch:${id}`
const BLOCK_COLORS = ["#c7d2fe", "#fde68a", "#bbf7d0", "#fecaca", "#e9d5ff"]
const PEN = { color: "#7c5cff", width: 3 }
const COMPONENT_SIZE = { width: 360, height: 220 }
const MIN = 12

export function readSketch(id: string): SketchOp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY(id)) ?? "[]")
  } catch {
    return []
  }
}

export function clearSketch(id: string) {
  localStorage.removeItem(KEY(id))
}

function opRect(op: SketchOp): Region | undefined {
  if (op.type === "block" || op.type === "component") return op.rect
  if (op.type === "move") return op.to
  return undefined
}

export function sketchBounds(ops: SketchOp[], fallback: Region): Region {
  const boxes: Region[] = []
  for (const op of ops) {
    if (op.type === "move") boxes.push(op.from, op.to)
    else if (op.type === "block" || op.type === "component") boxes.push(op.rect)
    else if (op.type === "stroke" && op.points.length) {
      const xs = op.points.map((p) => p.x)
      const ys = op.points.map((p) => p.y)
      boxes.push({ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 })
    }
  }
  if (!boxes.length) return fallback
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(Math.max(...boxes.map((b) => b.x + b.width)) - x)),
    height: Math.max(1, Math.round(Math.max(...boxes.map((b) => b.y + b.height)) - y)),
  }
}

function resize(r: Region, corner: Corner, dx: number, dy: number): Region {
  let { x, y, width, height } = r
  if (corner.includes("e")) width = Math.max(MIN, width + dx)
  if (corner.includes("s")) height = Math.max(MIN, height + dy)
  if (corner.includes("w")) {
    const w = Math.max(MIN, width - dx)
    x += width - w
    width = w
  }
  if (corner.includes("n")) {
    const h = Math.max(MIN, height - dy)
    y += height - h
    height = h
  }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }
}

function editable(t: HTMLElement | null) {
  return Boolean(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))
}

export function SketchLayer({
  surface,
  components,
  onReconcile,
  onExit,
  paused = false,
  toolbarHost,
  componentThumb,
}: {
  surface: Surface
  components: ClientEntry[]
  paused?: boolean
  toolbarHost?: HTMLElement | null
  componentThumb?: (id: string) => string
  onReconcile: (sketch: Sketch, region: Region) => void
  onExit: () => void
}) {
  const storyId = surface.storyId
  const frame = surface.frame!
  const host = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [ops, setOps] = useState<SketchOp[]>(() => readSketch(storyId))
  const opsRef = useRef(ops)
  opsRef.current = ops
  const history = useRef<SketchOp[][]>([])
  const [tool, setTool] = useState<Tool>("select")
  const [hover, setHover] = useState<Region>()
  const [selection, setSelection] = useState<Selection>()
  const [editing, setEditing] = useState<Editing>()
  const [palette, setPalette] = useState(false)
  const [filter, setFilter] = useState("")
  const [dragging, setDragging] = useState<{ entry: ClientEntry; x: number; y: number; sx: number; sy: number }>()
  useScrollSync(frame, host, layer, undefined, true)

  const win = useCallback(() => frame()?.contentWindow as (Window & { __stageboard_sketch?: SketchApi }) | null | undefined, [frame])
  const api = useCallback(() => win()?.__stageboard_sketch, [win])

  useEffect(() => {
    api()?.apply(ops)
    const t = setTimeout(() => localStorage.setItem(KEY(storyId), JSON.stringify(ops)), 250)
    return () => clearTimeout(t)
  }, [ops, api, storyId])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source === "stageboard" && e.data.type === "ready" && e.source === win()) api()?.apply(opsRef.current)
    }
    window.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("message", onMessage)
      api()?.apply([])
    }
  }, [api, win])

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
    setSelection(undefined)
  }

  const point = (clientX: number, clientY: number) => {
    const el = frame()!
    const r = el.getBoundingClientRect()
    const w = win()
    const s = el.offsetWidth ? r.width / el.offsetWidth : 1
    const cx = (clientX - r.left) / s
    const cy = (clientY - r.top) / s
    return { cx, cy, x: Math.round(cx + (w?.scrollX ?? 0)), y: Math.round(cy + (w?.scrollY ?? 0)) }
  }

  const hitOp = (x: number, y: number): number => {
    for (let i = opsRef.current.length - 1; i >= 0; i--) {
      const op = opsRef.current[i]
      if (op.type !== "block" && op.type !== "component") continue
      const r = op.rect
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return i
    }
    return -1
  }

  // Moved elements live as copies at their new spot; find them there before asking the page.
  const movedAt = (x: number, y: number): SketchTarget | undefined => {
    for (let i = opsRef.current.length - 1; i >= 0; i--) {
      const op = opsRef.current[i]
      if (op.type !== "move") continue
      const r = op.to
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        return api()?.find(op.selector) ?? { selector: op.selector, components: op.components, rect: op.from, text: op.text, editable: false }
      }
    }
    return undefined
  }
  const targetAt = (p: { x: number; y: number; cx: number; cy: number }) => movedAt(p.x, p.y) ?? api()?.at(p.cx, p.cy)

  const moveIndex = (selector: string) => opsRef.current.findIndex((o) => o.type === "move" && o.selector === selector)

  const selectedRect = (): Region | undefined => {
    if (!selection) return undefined
    if (selection.kind === "op") return opRect(ops[selection.index])
    const i = ops.findIndex((o) => o.type === "move" && o.selector === selection.target.selector)
    return i >= 0 ? (ops[i] as Extract<SketchOp, { type: "move" }>).to : selection.target.rect
  }

  // Moving or resizing: the element gets (or updates) one move op; drawn items change their own rect.
  const startTransform = (e: RPointerEvent, sel: Selection, corner?: Corner) => {
    const start = point(e.clientX, e.clientY)
    let index = sel.kind === "op" ? sel.index : moveIndex(sel.target.selector)
    const base = sel.kind === "op" ? opRect(opsRef.current[sel.index])! : index >= 0 ? (opsRef.current[index] as Extract<SketchOp, { type: "move" }>).to : sel.target.rect
    let moved = false
    const move = (ev: PointerEvent) => {
      const p = point(ev.clientX, ev.clientY)
      const dx = p.x - start.x
      const dy = p.y - start.y
      if (!moved && Math.hypot(dx, dy) < 3) return
      if (!moved) remember()
      moved = true
      const rect = corner ? resize(base, corner, dx, dy) : { ...base, x: base.x + dx, y: base.y + dy }
      setOps((cur) => {
        const next = [...cur]
        if (sel.kind === "op") {
          const op = next[sel.index]
          if (op.type === "block" || op.type === "component") next[sel.index] = { ...op, rect }
        } else if (index >= 0) {
          next[index] = { ...(next[index] as Extract<SketchOp, { type: "move" }>), to: rect }
        } else {
          index = next.length
          next.push({ type: "move", selector: sel.target.selector, components: sel.target.components, text: sel.target.text, from: sel.target.rect, to: rect })
        }
        return next
      })
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    setPalette(false)
    const p = point(e.clientX, e.clientY)
    if (tool === "pen") {
      remember()
      const index = opsRef.current.length
      setOps((cur) => [...cur, { type: "stroke", points: [{ x: p.x, y: p.y }], color: PEN.color, width: PEN.width }])
      let last = p
      const move = (ev: PointerEvent) => {
        const q = point(ev.clientX, ev.clientY)
        if (Math.hypot(q.x - last.x, q.y - last.y) < 2) return
        last = q
        setOps((cur) => {
          const next = [...cur]
          const op = next[index]
          if (op?.type === "stroke") next[index] = { ...op, points: [...op.points, { x: q.x, y: q.y }] }
          return next
        })
      }
      const up = () => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      return
    }
    if (tool === "block") {
      remember()
      const index = opsRef.current.length
      const color = BLOCK_COLORS[opsRef.current.filter((o) => o.type === "block").length % BLOCK_COLORS.length]
      setOps((cur) => [...cur, { type: "block", rect: { x: p.x, y: p.y, width: 1, height: 1 }, color }])
      const move = (ev: PointerEvent) => {
        const q = point(ev.clientX, ev.clientY)
        const rect = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), height: Math.abs(q.y - p.y) }
        setOps((cur) => cur.map((o, i) => (i === index && o.type === "block" ? { ...o, rect } : o)))
      }
      const up = () => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        setOps((cur) =>
          cur.map((o, i) => (i === index && o.type === "block" && (o.rect.width < MIN || o.rect.height < MIN) ? { ...o, rect: { x: p.x - 100, y: p.y - 60, width: 200, height: 120 } } : o)),
        )
        setSelection({ kind: "op", index })
        setTool("select")
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      return
    }
    const hit = hitOp(p.x, p.y)
    if (hit >= 0) {
      const sel: Selection = { kind: "op", index: hit }
      setSelection(sel)
      startTransform(e, sel)
      return
    }
    const target = targetAt(p)
    if (!target) {
      setSelection(undefined)
      return
    }
    const sel: Selection = { kind: "el", target }
    setSelection(sel)
    startTransform(e, sel)
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (tool !== "select" || e.buttons) return
    const p = point(e.clientX, e.clientY)
    const hit = hitOp(p.x, p.y)
    if (hit >= 0) return setHover(opRect(opsRef.current[hit]))
    const target = targetAt(p)
    const i = target ? moveIndex(target.selector) : -1
    setHover(i >= 0 ? (opsRef.current[i] as Extract<SketchOp, { type: "move" }>).to : target?.rect)
  }

  const onDoubleClick = (e: RMouseEvent) => {
    const p = point(e.clientX, e.clientY)
    const hit = hitOp(p.x, p.y)
    if (hit >= 0) {
      const op = opsRef.current[hit]
      if (op.type === "block") setEditing({ index: hit, rect: op.rect, value: op.label ?? "", before: op.label ?? "" })
      return
    }
    const target = targetAt(p)
    if (!target?.editable) return
    const existing = opsRef.current.find((o) => o.type === "text" && o.selector === target.selector) as Extract<SketchOp, { type: "text" }> | undefined
    const i = moveIndex(target.selector)
    const rect = i >= 0 ? (opsRef.current[i] as Extract<SketchOp, { type: "move" }>).to : target.rect
    setEditing({ selector: target.selector, rect, value: existing?.after ?? target.text ?? "", before: existing?.before ?? target.text ?? "" })
  }

  const finishEdit = (save: boolean) => {
    const ed = editing
    setEditing(undefined)
    if (!ed || !save) return
    if (ed.index !== undefined) {
      commit(opsRef.current.map((o, i) => (i === ed.index && o.type === "block" ? { ...o, label: ed.value.trim() || undefined } : o)))
      return
    }
    if (!ed.selector) return
    const target = api()?.find(ed.selector)
    const rest = opsRef.current.filter((o) => !(o.type === "text" && o.selector === ed.selector))
    commit(ed.value === ed.before ? rest : [...rest, { type: "text", selector: ed.selector, components: target?.components ?? [], before: ed.before, after: ed.value }])
  }

  const removeSelected = () => {
    if (!selection) return
    if (selection.kind === "op") commit(opsRef.current.filter((_, i) => i !== selection.index))
    else commit(opsRef.current.filter((o) => !((o.type === "move" || o.type === "text") && o.selector === selection.target.selector)))
    setSelection(undefined)
  }

  const placeComponent = (entry: ClientEntry, clientX?: number, clientY?: number) => {
    const w = win()
    const r = frame()!.getBoundingClientRect()
    const cx = clientX ?? r.left + r.width / 2
    const cy = clientY ?? r.top + r.height / 2
    const p = point(cx, cy)
    const rect = { x: p.x - COMPONENT_SIZE.width / 2, y: p.y - COMPONENT_SIZE.height / 2, ...COMPONENT_SIZE }
    commit([...opsRef.current, { type: "component", rect, storyId: entry.id, title: `${entry.title} / ${entry.name}` }])
    setSelection({ kind: "op", index: opsRef.current.length })
    setPalette(false)
  }

  const reconcile = () => {
    const w = win()
    if (!ops.length || !w) return
    const viewport = { width: w.innerWidth, height: w.innerHeight }
    const scroll = { x: Math.round(w.scrollX), y: Math.round(w.scrollY) }
    onReconcile({ ops, viewport, scroll }, sketchBounds(ops, { ...scroll, ...viewport }))
  }

  const stateRef = useRef({ undo, removeSelected, reconcile, selection, editing, paused })
  stateRef.current = { undo, removeSelected, reconcile, selection, editing, paused }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stateRef.current.paused || editable(e.target as HTMLElement) || stateRef.current.editing) return
      const s = stateRef.current
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        s.undo()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "v") setTool("select")
      else if (e.key === "p") setTool("pen")
      else if (e.key === "b") setTool("block")
      else if (e.key === "c") setPalette((v) => !v)
      else if (e.key === "Backspace" || e.key === "Delete") s.removeSelected()
      else if (e.key === "Enter") s.reconcile()
      else if (e.key === "ArrowUp" && s.selection?.kind === "el") {
        e.preventDefault()
        const parent = api()?.parentOf(s.selection.target.selector)
        if (parent) setSelection({ kind: "el", target: parent })
      } else if (e.key === "Escape") {
        if (s.selection) setSelection(undefined)
        else onExit()
      } else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [api, onExit])

  useEffect(() => {
    if (!dragging) return
    const end = () => setTimeout(() => setDragging(undefined), 0)
    window.addEventListener("pointerup", end)
    return () => window.removeEventListener("pointerup", end)
  }, [Boolean(dragging)])

  const onWheel = (e: RWheelEvent) => {
    try {
      win()?.scrollBy({ left: e.deltaX, top: e.deltaY, behavior: "instant" })
    } catch {}
  }

  const bar = (
      <div className="sbu-sketch-bar sbu-panel" data-docked={Boolean(toolbarHost)} role="toolbar" aria-label="Sketch tools" onPointerDown={(e) => e.stopPropagation()}>
        <ToolButton on={tool === "select"} onClick={() => setTool("select")} label="Select, move and resize · V · double-click text to edit">
          <PointerIcon size={15} />
        </ToolButton>
        <ToolButton on={tool === "pen"} onClick={() => setTool("pen")} label="Draw · P">
          <PenIcon size={15} />
        </ToolButton>
        <ToolButton on={tool === "block"} onClick={() => setTool("block")} label="Block · B">
          <SquareIcon size={15} />
        </ToolButton>
        <ToolButton on={palette} onClick={() => setPalette((v) => !v)} label="Components from this app · C">
          <ComponentIcon size={15} />
        </ToolButton>
        <span className="sbu-sketch-sep" />
        <ToolButton on={false} onClick={undo} label="Undo · ⌘Z" disabled={!history.current.length}>
          <UndoIcon size={15} />
        </ToolButton>
        <ToolButton on={false} onClick={() => (commit([]), setSelection(undefined))} label="Clear the sketch" disabled={!ops.length}>
          <CloseIcon size={13} />
        </ToolButton>
        <span className="sbu-sketch-sep" />
        <Button variant="solid" disabled={!ops.length} onClick={reconcile} title="Send the sketch to the agent · Enter" count={ops.length}>
          Reconcile
        </Button>
      </div>
  )

  const rect = selectedRect()
  const label = selection?.kind === "el" ? selection.target.components[0]?.name ?? selection.target.selector.split(" > ").pop() : undefined
  const shown = components.filter((c) => !filter || `${c.title} ${c.name}`.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div
      ref={host}
      className="sbu-sketch"
      data-tool={tool}
      onPointerMove={(e) => {
        if (dragging) setDragging({ ...dragging, x: e.clientX, y: e.clientY })
      }}
      onPointerUp={(e) => {
        if (!dragging) return
        const r = frame()!.getBoundingClientRect()
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        const moved = Math.hypot(e.clientX - dragging.sx, e.clientY - dragging.sy) > 6
        if (inside && moved) placeComponent(dragging.entry, e.clientX, e.clientY)
        setDragging(undefined)
      }}
    >
      <div
        className="sbu-sketch-catch"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(undefined)}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
      />
      <div ref={layer} className="sbu-annot-layer">
        {hover && tool === "select" && <div className="sbu-sketch-hover" style={{ left: hover.x, top: hover.y, width: hover.width, height: hover.height }} />}
        {rect && (
          <div className="sbu-sketch-sel" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
            {label && <span className="sbu-sketch-label">{label}</span>}
            {(["nw", "ne", "sw", "se"] as Corner[]).map((c) => (
              <span
                key={c}
                className="sbu-sketch-handle"
                data-corner={c}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  startTransform(e, selection!, c)
                }}
              />
            ))}
          </div>
        )}
        {editing && (
          <input
            className="sbu-sketch-edit"
            style={{ left: editing.rect.x, top: editing.rect.y, width: Math.max(120, editing.rect.width), height: Math.max(26, editing.rect.height) }}
            value={editing.value}
            autoFocus
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onBlur={() => finishEdit(true)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter") finishEdit(true)
              if (e.key === "Escape") finishEdit(false)
            }}
            aria-label="Edit text"
          />
        )}
      </div>

      {palette && (
        <div className="sbu-sketch-palette sbu-panel" onPointerDown={(e) => e.stopPropagation()}>
          <Input
            className="sbu-palette-filter"
            placeholder="Find a component"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape" && e.key !== "Enter") return
              e.stopPropagation()
              if (e.key === "Enter" && shown[0]) placeComponent(shown[0])
              else setPalette(false)
            }}
            autoFocus
            aria-label="Find a component"
          />
          <ul>
            {shown.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    setDragging({ entry: c, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY })
                  }}
                  onClick={() => placeComponent(c)}
                  title="Drag onto the page, or click to drop it in the middle"
                >
                  {componentThumb && (
                    <span className="sbu-palette-shot">
                      <Thumb src={componentThumb(c.id)} className="sbu-thumb-center" />
                    </span>
                  )}
                  <span className="sbu-palette-name">{c.title.split("/").pop()}</span>
                  <span className="sbu-dim">{c.name}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="sbu-dim">No component stories match</li>}
          </ul>
        </div>
      )}
      {dragging && Math.hypot(dragging.x - dragging.sx, dragging.y - dragging.sy) > 6 && (
        <div className="sbu-sketch-ghost" style={{ left: dragging.x, top: dragging.y }}>
          {dragging.entry.title.split("/").pop()} · {dragging.entry.name}
        </div>
      )}

      {toolbarHost ? createPortal(bar, toolbarHost) : bar}
    </div>
  )
}

function ToolButton({ on, onClick, label, disabled, children }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; children: ReactNode }) {
  return <IconButton variant="ghost" icon={children} label={label} on={on} onClick={onClick} disabled={disabled} />
}
