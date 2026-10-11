import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react"
import type { PageParameters } from "stageboard"
import type { ClientEntry } from "./types"

export type PageNode = { entry: ClientEntry; page: PageParameters }

type Pos = { x: number; y: number }
type View = { x: number; y: number; k: number }

const FRAME_W = 1440
const FRAME_H = 900
const SCALE = 0.3
const NODE_W = FRAME_W * SCALE
const BODY_H = FRAME_H * SCALE
const HEAD_H = 34
const NODE_H = BODY_H + HEAD_H
const GAP_X = 160
const GAP_Y = 90
const STORAGE = "stageboard:canvas:positions"

function routePattern(route: string): RegExp {
  const escaped = route
    .replace(/\/$/, "")
    .split("/")
    .map((seg) => (/^\[.+\]$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/")
  return new RegExp(`^${escaped || ""}/?$`)
}

export function findByRoute(nodes: PageNode[], href: string): PageNode | undefined {
  const path = href.split(/[?#]/)[0] || "/"
  return nodes.find((n) => n.page.route === path) ?? nodes.find((n) => routePattern(n.page.route).test(path))
}

function autoLayout(nodes: PageNode[]): Record<string, Pos> {
  const byId = new Map(nodes.map((n) => [n.entry.id, n]))
  const depth = new Map<string, number>()
  const roots = nodes.filter((n) => n.page.route === "/" || n.page.route.split("/").filter(Boolean).length === 0)
  const queue: string[] = (roots.length ? roots : nodes.slice(0, 1)).map((n) => n.entry.id)
  queue.forEach((id) => depth.set(id, 0))
  while (queue.length) {
    const id = queue.shift()!
    const node = byId.get(id)!
    for (const link of node.page.links ?? []) {
      const target = findByRoute(nodes, link)
      if (target && !depth.has(target.entry.id)) {
        depth.set(target.entry.id, depth.get(id)! + 1)
        queue.push(target.entry.id)
      }
    }
  }
  for (const n of nodes) {
    if (!depth.has(n.entry.id)) depth.set(n.entry.id, n.page.route.split("/").filter(Boolean).length + 1)
  }
  const columns = new Map<number, PageNode[]>()
  for (const n of nodes) {
    const d = depth.get(n.entry.id)!
    if (!columns.has(d)) columns.set(d, [])
    columns.get(d)!.push(n)
  }
  const out: Record<string, Pos> = {}
  for (const [d, col] of columns) {
    col.sort((a, b) => (a.page.group ?? a.page.route).localeCompare(b.page.group ?? b.page.route))
    col.forEach((n, i) => (out[n.entry.id] = { x: d * (NODE_W + GAP_X), y: i * (NODE_H + GAP_Y) }))
  }
  return out
}

function readPositions(): Record<string, Pos> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) ?? "{}")
  } catch {
    return {}
  }
}

export function Canvas({
  nodes,
  frameUrl,
  inspecting,
  onOpen,
  registerFrame,
}: {
  nodes: PageNode[]
  frameUrl: (id: string) => string
  inspecting: boolean
  onOpen: (id: string) => void
  registerFrame: (id: string, el: HTMLIFrameElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 60, y: 60, k: 0.9 })
  const [saved, setSaved] = useState<Record<string, Pos>>(readPositions)
  const [focus, setFocus] = useState<string>()
  const [flash, setFlash] = useState<string>()
  const [hotEdge, setHotEdge] = useState<string>()
  const [panning, setPanning] = useState(false)
  const auto = useMemo(() => autoLayout(nodes), [nodes])
  const pos = useCallback((id: string) => saved[id] ?? auto[id] ?? { x: 0, y: 0 }, [saved, auto])

  useEffect(() => {
    localStorage.setItem(STORAGE, JSON.stringify(saved))
  }, [saved])

  const fit = useCallback(() => {
    const el = ref.current
    if (!el || !nodes.length) return
    const xs = nodes.map((n) => pos(n.entry.id))
    const minX = Math.min(...xs.map((p) => p.x))
    const minY = Math.min(...xs.map((p) => p.y))
    const maxX = Math.max(...xs.map((p) => p.x + NODE_W))
    const maxY = Math.max(...xs.map((p) => p.y + NODE_H))
    const k = Math.min(1.2, Math.min(el.clientWidth / (maxX - minX + 120), el.clientHeight / (maxY - minY + 120)))
    setView({ k, x: (el.clientWidth - (maxX - minX) * k) / 2 - minX * k, y: (el.clientHeight - (maxY - minY) * k) / 2 - minY * k })
  }, [nodes, pos])

  useEffect(() => {
    if (nodes.length) fit()
  }, [nodes.length])

  const centerOn = useCallback(
    (id: string, k?: number) => {
      const el = ref.current
      if (!el) return
      const p = pos(id)
      const scale = k ?? Math.min(2.4, (el.clientWidth * 0.8) / NODE_W, (el.clientHeight * 0.8) / NODE_H)
      setView({ k: scale, x: el.clientWidth / 2 - (p.x + NODE_W / 2) * scale, y: el.clientHeight / 2 - (p.y + NODE_H / 2) * scale })
    },
    [pos],
  )

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard" || e.data.type !== "navigate") return
      const from = nodes.find((n) => document.querySelector<HTMLIFrameElement>(`iframe[data-node="${n.entry.id}"]`)?.contentWindow === e.source)
      const target = findByRoute(nodes, String(e.data.href))
      if (!target) return
      setFlash(target.entry.id)
      if (from) setHotEdge(`${from.entry.id}->${target.entry.id}`)
      centerOn(target.entry.id, view.k)
      setTimeout(() => {
        setFlash(undefined)
        setHotEdge(undefined)
      }, 1600)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [nodes, centerOn, view.k])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView((v) => {
        if (e.ctrlKey || e.metaKey) {
          const k = Math.min(4, Math.max(0.08, v.k * Math.exp(-e.deltaY * 0.01)))
          return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k }
        }
        return { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const onBackgroundDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && !(e.target as Element).classList.contains("sbu-world")) return
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    setPanning(true)
    setFocus(undefined)
    const move = (ev: PointerEvent) => setView((v) => ({ ...v, x: start.vx + ev.clientX - start.x, y: start.vy + ev.clientY - start.y }))
    const up = () => {
      setPanning(false)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const onNodeDrag = (id: string, e: RPointerEvent) => {
    e.stopPropagation()
    const start = { x: e.clientX, y: e.clientY, p: pos(id) }
    const move = (ev: PointerEvent) =>
      setSaved((s) => ({ ...s, [id]: { x: start.p.x + (ev.clientX - start.x) / view.k, y: start.p.y + (ev.clientY - start.y) / view.k } }))
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const edges = nodes.flatMap((n) =>
    (n.page.links ?? [])
      .map((link) => findByRoute(nodes, link))
      .filter((t): t is PageNode => Boolean(t) && t!.entry.id !== n.entry.id)
      .map((t) => {
        const a = pos(n.entry.id)
        const b = pos(t.entry.id)
        const sameColumn = Math.abs(b.x - a.x) < NODE_W
        if (sameColumn) {
          const down = b.y > a.y
          const x1 = a.x + NODE_W / 2
          const y1 = down ? a.y + NODE_H : a.y
          const x2 = b.x + NODE_W / 2
          const y2 = down ? b.y : b.y + NODE_H
          const dy = Math.max(40, Math.abs(y2 - y1) / 2) * (down ? 1 : -1)
          return { key: `${n.entry.id}->${t.entry.id}`, d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}` }
        }
        const forward = b.x >= a.x
        const x1 = forward ? a.x + NODE_W : a.x
        const y1 = a.y + NODE_H / 2
        const x2 = forward ? b.x : b.x + NODE_W
        const y2 = b.y + NODE_H / 2
        const dx = Math.max(60, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1)
        return { key: `${n.entry.id}->${t.entry.id}`, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` }
      }),
  )

  return (
    <div
      ref={ref}
      className="sbu-canvas"
      data-panning={panning}
      onPointerDown={onBackgroundDown}
      style={{ backgroundSize: `${22 * view.k}px ${22 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
    >
      <div className="sbu-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="sbu-edges" width="1" height="1">
          <defs>
            <marker id="sbu-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(185,168,255,.7)" />
            </marker>
          </defs>
          {edges.map((e) => (
            <path key={e.key} d={e.d} data-hot={hotEdge === e.key} markerEnd="url(#sbu-arrow)" />
          ))}
        </svg>
        {nodes.map((n) => {
          const p = pos(n.entry.id)
          return (
            <div
              key={n.entry.id}
              className="sbu-node"
              data-focus={focus === n.entry.id}
              data-flash={flash === n.entry.id}
              style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
            >
              <div className="sbu-node-head" onPointerDown={(e) => onNodeDrag(n.entry.id, e)} onDoubleClick={() => onOpen(n.entry.id)}>
                <span className="sbu-node-route">{n.page.route}</span>
                <span className="sbu-node-title">{n.page.title ?? n.entry.title}</span>
              </div>
              <div className="sbu-node-body" data-live={inspecting} style={{ height: BODY_H }}>
                <iframe
                  data-node={n.entry.id}
                  ref={(el) => registerFrame(n.entry.id, el)}
                  src={frameUrl(n.entry.id)}
                  loading="lazy"
                  title={n.entry.id}
                  style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${SCALE})` }}
                />
                {!inspecting && (
                  <div
                    className="sbu-node-shield"
                    onClick={() => {
                      setFocus(n.entry.id)
                      centerOn(n.entry.id)
                    }}
                    onDoubleClick={() => onOpen(n.entry.id)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="sbu-hud" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={fit}>Fit</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(4, v.k * 1.25) }))}>+</button>
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.08, v.k / 1.25) }))}>−</button>
        <button onClick={() => setSaved({})}>Auto layout</button>
        <span className="sbu-dim" style={{ padding: "0 6px" }}>
          {Math.round(view.k * 100)}%
        </span>
      </div>
      <div className="sbu-hint">Scroll to pan · ⌘/Ctrl + scroll to zoom · double-click a page to dive in</div>
    </div>
  )
}
