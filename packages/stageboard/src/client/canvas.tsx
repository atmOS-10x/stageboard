import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react"
import type { PageParameters } from "stageboard"
import { useStageboard } from "stageboard/react"
import { AnnotationLayer, type Surface } from "./annotate"
import { storyUrl } from "./api"
import { DreamCard, DreamNode, markReveal, pendingReveals } from "./dreams"
import { MapSketchScreen, MapSketchWorld, useMapSketch, type MapFrame } from "./map-sketch"
import { Thumb } from "./thumb"
import { WaveCanvas } from "./waves"
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
const FRAME = { width: FRAME_W, height: FRAME_H }

function frameOf(id: string): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>(`iframe[data-node="${CSS.escape(id)}"]`)
}

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

function groupedLayout(nodes: PageNode[]): Record<string, Pos> {
  const order: string[] = []
  const groups = new Map<string, PageNode[]>()
  for (const n of nodes) {
    const g = n.page.group ?? n.entry.title.split("/")[0]
    if (!groups.has(g)) {
      groups.set(g, [])
      order.push(g)
    }
    groups.get(g)!.push(n)
  }
  const out: Record<string, Pos> = {}
  order.forEach((g, col) => {
    const list = groups.get(g)!.sort((a, b) => a.page.route.length - b.page.route.length || a.page.route.localeCompare(b.page.route))
    list.forEach((n, row) => (out[n.entry.id] = { x: col * (NODE_W + GAP_X), y: row * (NODE_H + GAP_Y) }))
  })
  return out
}

function autoLayout(nodes: PageNode[]): Record<string, Pos> {
  if (nodes.some((n) => n.page.group)) return groupedLayout(nodes)
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

export function SiteMapLoading({ entries }: { entries: ClientEntry[] }) {
  const shown = entries.slice(0, 12)
  return (
    <div className="sbu-canvas sbu-map-loading" role="status" aria-label={`Loading ${entries.length} pages`}>
      <div className="sbu-map-loading-grid">
        {shown.map((e, i) => (
          <div key={e.id} className="sbu-node sbu-dream" style={{ position: "relative", animationDelay: `${i * 40}ms` }}>
            <div className="sbu-node-head">
              <span className="sbu-node-title">{e.name}</span>
            </div>
            <div className="sbu-dream-body" style={{ aspectRatio: `${FRAME_W} / ${FRAME_H}` }}>
              <WaveCanvas mode="render" fps={30} />
            </div>
          </div>
        ))}
      </div>
      <div className="sbu-hint">Loading {entries.length} page{entries.length === 1 ? "" : "s"}…</div>
    </div>
  )
}

export function Canvas({
  nodes,
  frameUrl,
  thumbUrl,
  inspecting,
  annotating,
  sketching = false,
  onSketchExit = () => {},
  onOpen,
  registerFrame,
}: {
  nodes: PageNode[]
  frameUrl: (id: string) => string
  thumbUrl: (id: string) => string
  inspecting: boolean
  annotating: boolean
  sketching?: boolean
  onSketchExit?: () => void
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
  const [ready, setReady] = useState<Set<string>>(() => new Set())
  const auto = useMemo(() => autoLayout(nodes), [nodes])
  const pos = useCallback((id: string) => saved[id] ?? auto[id] ?? { x: 0, y: 0 }, [saved, auto])
  const dreams = useStageboard((s) => s.dreams)
  const [pending, setPending] = useState<{ parent: string; position: Pos }>()
  const [dragged, setDragged] = useState<Record<string, Pos>>({})
  const [revealing, setRevealing] = useState<Set<string>>(() => new Set())
  const realized = useMemo(() => new Map(nodes.filter((n) => n.page.dream).map((n) => [n.page.dream!, n.entry.id])), [nodes])
  const openDreams = dreams.filter((d) => !realized.has(d.id))
  const dreamPos = (id: string, fallback: Pos) => dragged[id] ?? fallback

  useEffect(() => {
    const placed: Record<string, Pos> = {}
    for (const d of dreams) {
      const id = realized.get(d.id)
      if (id && !saved[id]) placed[id] = d.position
    }
    if (Object.keys(placed).length) setSaved((s) => ({ ...s, ...placed }))
    const waiting = pendingReveals().filter((id) => realized.has(id))
    if (waiting.length) {
      waiting.forEach((id) => markReveal(id, false))
      setRevealing((r) => new Set([...r, ...waiting.map((id) => realized.get(id)!)]))
    }
  }, [dreams, realized])

  const freeSpot = useCallback(
    (parent: string): Pos => {
      const p = pos(parent)
      const taken = [...nodes.map((n) => pos(n.entry.id)), ...openDreams.map((d) => d.position)]
      const clear = (c: Pos) => !taken.some((t) => Math.abs(t.x - c.x) < NODE_W && Math.abs(t.y - c.y) < NODE_H)
      for (let i = 0; i < 12; i++) {
        const right = { x: p.x + NODE_W + GAP_X, y: p.y + i * (NODE_H + GAP_Y) }
        if (clear(right)) return right
      }
      return { x: p.x, y: p.y + NODE_H + GAP_Y }
    },
    [pos, nodes, openDreams],
  )

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
      if (e.data?.source === "stageboard" && e.data.type === "ready") {
        const node = nodes.find((n) => frameOf(n.entry.id)?.contentWindow === e.source)
        if (node) setReady((r) => (r.has(node.entry.id) ? r : new Set(r).add(node.entry.id)))
      }
      if (e.data?.source !== "stageboard" || e.data.type !== "navigate") return
      const from = nodes.find((n) => frameOf(n.entry.id)?.contentWindow === e.source)
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

  const pendingKey = pending ? `${pending.parent}:${Math.round(pending.position.x)}:${Math.round(pending.position.y)}` : ""
  useEffect(() => {
    const el = ref.current
    if (!pending || !el) return
    setView((v) => {
      const k = Math.max(v.k, Math.min(1.1, (el.clientWidth * 0.6) / NODE_W))
      if (v.k >= k) return v
      const cx = pending.position.x + NODE_W / 2
      const cy = pending.position.y + NODE_H / 2
      return { k, x: el.clientWidth / 2 - cx * k, y: el.clientHeight / 2 - cy * k }
    })
  }, [pendingKey])

  const zoomBy = (factor: number) => {
    const el = ref.current
    const cx = (el?.clientWidth ?? 0) / 2
    const cy = (el?.clientHeight ?? 0) / 2
    setView((v) => {
      const k = Math.min(4, Math.max(0.08, v.k * factor))
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }
    })
  }

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

  const onAddDrag = (parent: string, e: RPointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const el = ref.current!
    const rect = el.getBoundingClientRect()
    const toWorld = (cx: number, cy: number) => ({ x: (cx - rect.left - view.x) / view.k - 24, y: (cy - rect.top - view.y) / view.k - NODE_H / 2 })
    const start = { x: e.clientX, y: e.clientY }
    let moved = false
    setPending(undefined)
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return
      moved = true
      setPending({ parent, position: toWorld(ev.clientX, ev.clientY) })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      setPending({ parent, position: moved ? toWorld(ev.clientX, ev.clientY) : freeSpot(parent) })
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

  const liveIds = useMemo(() => {
    const ids = new Set<string>()
    if (focus) ids.add(focus)
    if (!inspecting) return ids
    const el = ref.current
    const w = el?.clientWidth ?? 1200
    const h = el?.clientHeight ?? 800
    const visible = nodes
      .map((n) => ({ id: n.entry.id, p: pos(n.entry.id) }))
      .filter(({ p }) => {
        const x = p.x * view.k + view.x
        const y = p.y * view.k + view.y
        return x + NODE_W * view.k > 0 && y + NODE_H * view.k > 0 && x < w && y < h
      })
      .slice(0, 8)
    for (const v of visible) ids.add(v.id)
    return ids
  }, [focus, inspecting, nodes, pos, view])
  const isLive = (id: string) => liveIds.has(id)

  useEffect(() => {
    setReady((r) => {
      const next = new Set([...r].filter((id) => liveIds.has(id)))
      return next.size === r.size ? r : next
    })
  }, [liveIds])

  const mapFrames = useMemo<MapFrame[]>(
    () =>
      nodes.map((n) => {
        const p = pos(n.entry.id)
        return {
          storyId: n.entry.id,
          title: n.page.title ?? `${n.entry.title} / ${n.entry.name}`,
          route: n.page.route,
          rect: { x: p.x, y: p.y + HEAD_H, width: NODE_W, height: BODY_H },
          scale: SCALE,
          frame: { x: p.x, y: p.y, width: NODE_W, height: NODE_H },
        }
      }),
    [nodes, pos],
  )
  const mapSketch = useMapSketch({ host: ref, view, frames: mapFrames, active: sketching, onExit: onSketchExit })

  const surfaces = useMemo(
    () =>
      new Map(
        nodes.map((n): [string, Surface] => [
          n.entry.id,
          {
            key: `map:${n.entry.id}`,
            storyId: n.entry.id,
            title: n.page.title ?? `${n.entry.title} / ${n.entry.name}`,
            url: storyUrl(frameUrl(n.entry.id)),
            frame: () => frameOf(n.entry.id),
          },
        ]),
      ),
    [nodes, frameUrl],
  )

  const groupLabels = useMemo(() => {
    const seen = new Map<string, Pos>()
    for (const n of nodes) {
      if (!n.page.group) continue
      const p = pos(n.entry.id)
      const prev = seen.get(n.page.group)
      if (!prev || p.y < prev.y) seen.set(n.page.group, p)
    }
    return [...seen.entries()]
  }, [nodes, pos])

  const dreamEdge = (parent: string | undefined, to: Pos, key: string) => {
    if (!parent || !nodes.some((n) => n.entry.id === parent)) return []
    const a = pos(parent)
    const x1 = a.x + NODE_W
    const y1 = a.y + NODE_H / 2
    const below = to.x < a.x + NODE_W
    if (below) {
      const ax = a.x + NODE_W / 2
      const ay = a.y + NODE_H
      const bx = to.x + NODE_W / 2
      return [{ key, d: `M${ax},${ay} C${ax},${ay + 50} ${bx},${to.y - 50} ${bx},${to.y}` }]
    }
    const y2 = to.y + NODE_H / 2
    const dx = Math.max(60, Math.abs(to.x - x1) / 2)
    return [{ key, d: `M${x1},${y1} C${x1 + dx},${y1} ${to.x - dx},${y2} ${to.x},${y2}` }]
  }
  const dreamEdges = [
    ...openDreams.flatMap((d) => dreamEdge(d.parent, dreamPos(d.id, d.position), `dream:${d.id}`)),
    ...(pending ? dreamEdge(pending.parent, pending.position, "dream:pending") : []),
  ]

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
      <div
        className="sbu-world"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, ["--sbu-k" as string]: view.k }}
      >
        <svg className="sbu-edges" width="1" height="1">
          <defs>
            <marker id="sbu-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="rgba(185,168,255,.7)" />
            </marker>
          </defs>
          {edges.map((e) => (
            <path key={e.key} d={e.d} data-hot={hotEdge === e.key} markerEnd="url(#sbu-arrow)" />
          ))}
          {dreamEdges.map((e) => (
            <path key={e.key} d={e.d} data-dream="true" markerEnd="url(#sbu-arrow)" />
          ))}
        </svg>
        {groupLabels.map(([group, p]) => (
          <div key={group} className="sbu-group-label" style={{ left: p.x, top: p.y - 64 }}>
            {group}
          </div>
        ))}
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
              <div className="sbu-node-body" data-live={isLive(n.entry.id)} style={{ height: BODY_H }}>
                <Thumb src={thumbUrl(n.entry.id)} />
                {isLive(n.entry.id) && (
                  <iframe
                    data-node={n.entry.id}
                    data-ready={ready.has(n.entry.id)}
                    ref={(el) => registerFrame(n.entry.id, el)}
                    src={frameUrl(n.entry.id)}
                    title={n.entry.id}
                    style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${SCALE})` }}
                  />
                )}
                {!inspecting && !annotating && (
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
              {revealing.has(n.entry.id) && (
                <div className="sbu-dream-reveal" style={{ top: HEAD_H, height: BODY_H }}>
                  <WaveCanvas mode="reveal" onDone={() => setRevealing((r) => new Set([...r].filter((x) => x !== n.entry.id)))} />
                </div>
              )}
              <AnnotationLayer
                surface={surfaces.get(n.entry.id)!}
                viewport={FRAME}
                style={{ top: HEAD_H, height: BODY_H, bottom: "auto" }}
              />
              {!annotating && !sketching && (
                <button
                  type="button"
                  className="sbu-node-add"
                  style={{ top: HEAD_H + BODY_H / 2 }}
                  onPointerDown={(e) => onAddDrag(n.entry.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setPending({ parent: n.entry.id, position: freeSpot(n.entry.id) })
                    }
                  }}
                  title="Drag out a new page"
                  aria-label={`New page from ${n.page.title ?? n.entry.title}`}
                >
                  +
                </button>
              )}
            </div>
          )
        })}
        {openDreams.map((d) => (
          <DreamNode
            key={d.id}
            dream={d}
            position={dreamPos(d.id, d.position)}
            width={NODE_W}
            bodyHeight={BODY_H}
            headHeight={HEAD_H}
            zoom={view.k}
            underlay={d.parent ? thumbUrl(d.parent) : undefined}
            onMove={(p) => setDragged((m) => ({ ...m, [d.id]: p }))}
          />
        ))}
        <MapSketchWorld s={mapSketch} k={view.k} active={sketching} />
        {pending && (
          <DreamCard
            key={`${pending.parent}`}
            parent={pending.parent}
            parentUrl={surfaces.get(pending.parent)?.url}
            position={pending.position}
            width={NODE_W}
            bodyHeight={BODY_H}
            headHeight={HEAD_H}
            onClose={() => setPending(undefined)}
          />
        )}
      </div>
      {sketching && <MapSketchScreen s={mapSketch} onExit={onSketchExit} />}
      <div className="sbu-hud" onPointerDown={(e) => e.stopPropagation()}>
        <button onClick={fit}>Fit</button>
        <button onClick={() => zoomBy(1.25)}>+</button>
        <button onClick={() => zoomBy(1 / 1.25)}>−</button>
        <button onClick={() => setSaved({})}>Auto layout</button>
        <span className="sbu-dim" style={{ padding: "0 6px" }}>
          {Math.round(view.k * 100)}%
        </span>
      </div>
      {!annotating && !sketching && <div className="sbu-hint">Scroll to pan · ⌘/Ctrl + scroll to zoom · double-click a page to dive in · drag + to draw a new page</div>}
    </div>
  )
}
