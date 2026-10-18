import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent as RWheelEvent,
} from "react"
import { useStageboard } from "stageboard/react"
import type { Job, Region } from "stageboard"
import { frameScroll, type VariantRef, type Viewport } from "./api"
import { Pin } from "./pins"

export type Surface = {
  key: string
  storyId: string
  title: string
  url: string
  variant?: VariantRef
  frame?: () => HTMLIFrameElement | null | undefined
  scrollsFrame?: boolean
}

export type Draft = { surface: Surface; region: Region; viewport: Viewport }

type AnnotateValue = {
  base: string
  active: boolean
  draft?: Draft
  begin: (draft: Draft) => void
  anchor: RefObject<HTMLElement | null>
  pins: Job[]
  openPin?: string
  pinAnchor: RefObject<HTMLElement | null>
  togglePin: (id: string, el: HTMLElement | null) => void
}

const AnnotateContext = createContext<AnnotateValue | undefined>(undefined)

export function useAnnotate(): AnnotateValue {
  const value = useContext(AnnotateContext)
  if (!value) throw new Error("AnnotationLayer must be rendered inside AnnotateProvider")
  return value
}

const DISMISSED = "stageboard:dismissed-pins"
const FRESH_MS = 30 * 60 * 1000
const POINT_REGION = { width: 120, height: 76 }
const DRAG_THRESHOLD = 4

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED) ?? "[]")
  } catch {
    return []
  }
}

export function isActive(job: Job): boolean {
  return job.status === "queued" || job.status === "running"
}

function pinVisible(job: Job, dismissed: string[], now: number): boolean {
  if (!job.target.region || !job.target.storyId || !job.target.viewport?.width) return false
  if (isActive(job)) return true
  if (dismissed.includes(job.id)) return false
  return now - new Date(job.updatedAt).getTime() < FRESH_MS
}

export function jobSurfaceVariant(job: Job): VariantRef | undefined {
  const id = job.target.variantId
  const key = id ? job.target.variantKeys?.[id] : undefined
  return id && key ? { id, key } : undefined
}

function belongsTo(job: Job, surface: Surface): boolean {
  if (job.target.storyId !== surface.storyId) return false
  const v = jobSurfaceVariant(job)
  if (!surface.variant) return !v
  return v?.id === surface.variant.id && v.key === surface.variant.key
}

export function AnnotateProvider({
  base,
  active,
  draft,
  onBegin,
  openPin,
  onTogglePin,
  dismissed,
  children,
}: {
  base: string
  active: boolean
  draft?: Draft
  onBegin: (draft: Draft) => void
  openPin?: string
  onTogglePin: (id: string | undefined) => void
  dismissed: string[]
  children: ReactNode
}) {
  const anchor = useRef<HTMLElement | null>(null)
  const pinAnchor = useRef<HTMLElement | null>(null)
  const jobs = useStageboard((s) => s.jobs)
  const pins = useMemo(() => {
    const now = Date.now()
    return jobs.filter((j) => pinVisible(j, dismissed, now))
  }, [jobs, dismissed])
  const togglePin = useCallback(
    (id: string, el: HTMLElement | null) => {
      pinAnchor.current = el
      onTogglePin(openPin === id ? undefined : id)
    },
    [openPin, onTogglePin],
  )
  const value = useMemo<AnnotateValue>(
    () => ({ base, active, draft, begin: onBegin, anchor, pins, openPin, pinAnchor, togglePin }),
    [base, active, draft, onBegin, pins, openPin, togglePin],
  )
  return <AnnotateContext.Provider value={value}>{children}</AnnotateContext.Provider>
}

export function useDismissedPins(): [string[], (id: string) => void] {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)
  const dismiss = useCallback((id: string) => {
    setDismissed((list) => {
      const next = [...list.filter((x) => x !== id), id].slice(-200)
      localStorage.setItem(DISMISSED, JSON.stringify(next))
      return next
    })
  }, [])
  return [dismissed, dismiss]
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function regionBetween(a: { x: number; y: number }, b: { x: number; y: number }): Region {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

function pointRegion(p: { x: number; y: number }, vp: Viewport, scroll: { x: number; y: number }): Region {
  const width = Math.min(POINT_REGION.width, vp.width)
  const height = Math.min(POINT_REGION.height, vp.height)
  return {
    x: clamp(p.x - width / 2, scroll.x, scroll.x + vp.width - width),
    y: clamp(p.y - height / 2, scroll.y, scroll.y + vp.height - height),
    width,
    height,
  }
}

function roundRegion(r: Region): Region {
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) }
}

function boxStyle(region: Region, vp: Viewport): CSSProperties {
  const u = 100 / vp.width
  return {
    left: `${region.x * u}cqw`,
    top: `${region.y * u}cqw`,
    width: `${region.width * u}cqw`,
    height: `${region.height * u}cqw`,
  }
}

function useScrollSync(
  frame: Surface["frame"],
  host: RefObject<HTMLDivElement | null>,
  layer: RefObject<HTMLDivElement | null>,
  viewport: Viewport | undefined,
  watching: boolean,
) {
  const last = useRef("")
  const sync = useCallback(() => {
    const el = layer.current
    const box = host.current
    if (!el || !box) return
    const off = frameScroll(frame?.())
    const s = viewport ? box.offsetWidth / viewport.width : 1
    const next = `translate(${-off.x * s}px, ${-off.y * s}px)`
    if (next !== last.current) el.style.transform = last.current = next
  }, [frame, host, layer, viewport])
  useLayoutEffect(() => {
    if (!frame || !watching) return
    let raf = 0
    let win: Window | null | undefined
    const tick = () => {
      const current = frame()?.contentWindow
      if (current !== win) {
        win?.removeEventListener("scroll", sync)
        win = current
        win?.addEventListener("scroll", sync, { passive: true })
      }
      sync()
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      win?.removeEventListener("scroll", sync)
    }
  }, [frame, watching, sync])
  return sync
}

export function AnnotationLayer({
  surface,
  viewport,
  style,
}: {
  surface: Surface
  viewport?: Viewport
  style?: CSSProperties
}) {
  const ctx = useAnnotate()
  const ref = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState<{ region: Region; viewport: Viewport }>()
  const gesture = useRef<{ start: { x: number; y: number }; client: { x: number; y: number }; moved: boolean; vp: Viewport; scroll: { x: number; y: number } }>(undefined)
  const isDraft = ctx.draft?.surface.key === surface.key
  const pins = useMemo(() => ctx.pins.filter((j) => belongsTo(j, surface)), [ctx.pins, surface])
  const sync = useScrollSync(surface.frame, ref, layer, viewport, Boolean(drawing || isDraft || pins.length))

  const measure = () => {
    const el = ref.current!
    const box = el.getBoundingClientRect()
    const vp = viewport ?? { width: el.offsetWidth, height: el.offsetHeight }
    return { box, vp }
  }

  const toStory = (clientX: number, clientY: number) => {
    const { box, vp } = measure()
    const s = vp.width / box.width
    const off = frameScroll(surface.frame?.())
    return {
      x: clamp((clientX - box.left) * s, 0, vp.width) + off.x,
      y: clamp((clientY - box.top) * s, 0, vp.height) + off.y,
      vp,
      off,
    }
  }

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toStory(e.clientX, e.clientY)
    gesture.current = { start: { x: p.x, y: p.y }, client: { x: e.clientX, y: e.clientY }, moved: false, vp: p.vp, scroll: p.off }
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < DRAG_THRESHOLD) return
    g.moved = true
    const p = toStory(e.clientX, e.clientY)
    setDrawing({ region: regionBetween(g.start, p), viewport: g.vp })
  }

  const finish = (e: RPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current
    gesture.current = undefined
    if (!g) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    setDrawing(undefined)
    if (cancelled) return
    const p = toStory(e.clientX, e.clientY)
    const region = g.moved ? regionBetween(g.start, p) : pointRegion(g.start, g.vp, g.scroll)
    if (region.width < 2 || region.height < 2) return
    ctx.begin({ surface, region: roundRegion(region), viewport: { width: Math.round(g.vp.width), height: Math.round(g.vp.height) } })
  }

  const onWheel = (e: RWheelEvent) => {
    if (!surface.scrollsFrame) return
    const win = surface.frame?.()?.contentWindow
    if (!win) return
    try {
      win.scrollBy({ left: e.deltaX, top: e.deltaY, behavior: "instant" })
      sync()
    } catch {}
  }

  return (
    <div ref={ref} className="sbu-annot" style={style}>
      {ctx.active && (
        <div
          className="sbu-annot-catch"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finish(e, false)}
          onPointerCancel={(e) => finish(e, true)}
          onWheel={onWheel}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      )}
      <div ref={layer} className="sbu-annot-layer">
        {drawing && <div className="sbu-sel" data-drawing="true" style={boxStyle(drawing.region, drawing.viewport)} />}
        {!drawing && isDraft && ctx.draft && (
          <div
            ref={(el) => {
              ctx.anchor.current = el
            }}
            className="sbu-sel"
            style={boxStyle(ctx.draft.region, ctx.draft.viewport)}
          />
        )}
        {pins.map((job) => (
          <PinSlot key={job.id} job={job} />
        ))}
      </div>
    </div>
  )
}

function PinSlot({ job }: { job: Job }) {
  const ctx = useAnnotate()
  const region = job.target.region!
  const vp = job.target.viewport
  const open = ctx.openPin === job.id
  const [hover, setHover] = useState(false)
  const box = boxStyle(region, vp)
  return (
    <>
      <div className="sbu-sel" data-pin={isActive(job) ? "running" : "idle"} data-show={open || hover} style={box} />
      <div className="sbu-pin-anchor" style={{ left: `calc(${box.left} + ${box.width})`, top: box.top }}>
        <Pin
          job={job}
          open={open}
          onHover={setHover}
          onClick={(el) => ctx.togglePin(job.id, el)}
        />
      </div>
    </>
  )
}

export type Placement = { left: number; top: number; origin: string }

const MARGIN = 10

export function useAnchored(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  candidates: (a: DOMRect, f: { width: number; height: number }) => Placement[],
  enabled = true,
): Placement | undefined {
  const [placement, setPlacement] = useState<Placement>()
  const candidatesRef = useRef(candidates)
  candidatesRef.current = candidates
  useLayoutEffect(() => {
    if (!enabled) return
    let raf = 0
    let last = ""
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const a = anchor.current
      const f = floating.current
      if (!a?.isConnected || !f) return
      const ar = a.getBoundingClientRect()
      const size = { width: f.offsetWidth, height: f.offsetHeight }
      const vw = window.innerWidth
      const vh = window.innerHeight
      const overflow = (p: Placement) =>
        Math.max(0, MARGIN - p.left) + Math.max(0, MARGIN - p.top) + Math.max(0, p.left + size.width - vw + MARGIN) + Math.max(0, p.top + size.height - vh + MARGIN)
      const best = candidatesRef.current(ar, size).reduce((a, b) => (overflow(b) < overflow(a) ? b : a))
      const next = {
        left: Math.round(clamp(best.left, MARGIN, Math.max(MARGIN, vw - size.width - MARGIN))),
        top: Math.round(clamp(best.top, MARGIN, Math.max(MARGIN, vh - size.height - MARGIN))),
        origin: best.origin,
      }
      const key = `${next.left},${next.top},${next.origin}`
      if (key !== last) {
        last = key
        setPlacement(next)
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [anchor, floating, enabled])
  return placement
}

export function besideRect(gap: number) {
  return (a: DOMRect, f: { width: number; height: number }): Placement[] => [
    { left: a.right + gap, top: a.top, origin: "left top" },
    { left: a.left - f.width - gap, top: a.top, origin: "right top" },
    { left: a.left, top: a.bottom + gap, origin: "left top" },
    { left: a.left, top: a.top - f.height - gap, origin: "left bottom" },
    { left: a.right - f.width, top: a.bottom + gap, origin: "right top" },
  ]
}

export function belowAnchor(gap: number) {
  return (a: DOMRect, f: { width: number; height: number }): Placement[] => [
    { left: a.left, top: a.bottom + gap, origin: "left top" },
    { left: a.left, top: a.top - f.height - gap, origin: "left bottom" },
    { left: a.right - f.width, top: a.bottom + gap, origin: "right top" },
    { left: a.right - f.width, top: a.top - f.height - gap, origin: "right bottom" },
  ]
}

export function useOutsidePointer(ref: RefObject<HTMLElement | null>, onOutside: (target: Element) => void, enabled = true) {
  const cb = useRef(onOutside)
  cb.current = onOutside
  useEffect(() => {
    if (!enabled) return
    let down: { x: number; y: number; target: Element } | undefined
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      down = ref.current?.contains(t) || t.closest?.(".sbu-hud") ? undefined : { x: e.clientX, y: e.clientY, target: t }
    }
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < DRAG_THRESHOLD) cb.current(down.target)
      down = undefined
    }
    window.addEventListener("pointerdown", onDown, true)
    window.addEventListener("pointerup", onUp, true)
    return () => {
      window.removeEventListener("pointerdown", onDown, true)
      window.removeEventListener("pointerup", onUp, true)
    }
  }, [ref, enabled])
}
