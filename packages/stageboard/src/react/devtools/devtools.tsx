import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ElementTarget, Job } from "../../core/protocol"
import { componentChain, cssPath, nearestVariant, variantBoundaryRects } from "../fiber"
import { isActiveJob, startBridge, useStageboard } from "../store"
import { Panel } from "./panel"
import { devtoolsCss } from "./styles"

export type DevtoolsOptions = {
  base?: string
  embedded?: boolean
  hotkey?: string
}

type Picked = { el: Element; target: ElementTarget }

const HOST_ATTR = "data-stageboard-devtools"
const MESSAGE_SOURCE = "stageboard"

function isOwnNode(el: Element | null): boolean {
  return Boolean(el?.closest?.(`[${HOST_ATTR}]`))
}

export function describeElement(el: Element): ElementTarget {
  const rect = el.getBoundingClientRect()
  const variant = nearestVariant(el)
  const params = new URLSearchParams(location.search)
  return {
    url: location.href,
    title: document.title,
    selector: cssPath(el),
    tag: el.tagName.toLowerCase(),
    text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240) || undefined,
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
    viewport: { width: innerWidth, height: innerHeight },
    components: componentChain(el),
    variantId: variant?.id,
    variantKey: variant?.active,
    storyId: params.get("story") ?? undefined,
  }
}

function registerAngleProperty() {
  const css = (globalThis as { CSS?: { registerProperty?: (d: object) => void } }).CSS
  try {
    css?.registerProperty?.({ name: "--sb-angle", syntax: "<angle>", inherits: false, initialValue: "0deg" })
  } catch {}
}

function useRafTick(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 120) {
        last = t
        setTick((n) => n + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
}

function elapsed(job: Job): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(job.createdAt).getTime()) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function jobLabel(job: Job): string {
  if (job.kind === "variants") {
    const done = job.producedFiles.length
    return `Generating ${job.count} variant${job.count === 1 ? "" : "s"}${done ? ` · ${done} ready` : ""}`
  }
  if (job.kind === "adopt") return "Adopting variant"
  return "Applying change"
}

function JobOverlays() {
  const jobs = useStageboard((s) => s.jobs.filter(isActiveJob))
  useRafTick(jobs.length > 0)
  return (
    <>
      {jobs.flatMap((job) => {
        const rects = jobRects(job)
        return rects.map((r, i) => (
          <div
            key={`${job.id}-${i}`}
            className="sb-job"
            data-inside={r.top < 18}
            style={{ left: r.left, top: r.top, width: r.width, height: Math.max(r.height, 24) }}
          >
            <span className="sb-job-pill">
              <span className="sb-spinner" />
              {jobLabel(job)}
              <span style={{ color: "var(--sb-muted)", fontWeight: 400 }}>{elapsed(job)}</span>
            </span>
          </div>
        ))
      })}
    </>
  )
}

function jobRects(job: Job): DOMRect[] {
  const story = new URLSearchParams(location.search).get("story")
  if (job.target.storyId ? job.target.storyId !== story : !sameDocument(job.target.url)) return []
  const region = job.target.region
  const page = region && new DOMRect(region.x - scrollX, region.y - scrollY, region.width, region.height)
  const el = job.target.selector ? safeQuery(job.target.selector) : null
  if (el) {
    const r = el.getBoundingClientRect()
    if (!page || overlaps(r, page)) return [r]
  }
  if (job.variantId) {
    const boundaries = variantBoundaryRects(job.variantId)
    const hit = page ? boundaries.filter((r) => overlaps(r, page)) : boundaries
    if (hit.length) return hit.slice(0, 1)
  }
  return page ? [page] : []
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
}

function sameDocument(url: string): boolean {
  try {
    const u = new URL(url)
    return u.pathname === location.pathname && u.searchParams.get("story") === new URLSearchParams(location.search).get("story")
  } catch {
    return false
  }
}

function safeQuery(selector: string): Element | null {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

function Mark() {
  return (
    <svg className="sb-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <rect x="13" y="13" width="8" height="8" rx="4" fill="url(#sbg)" />
      <defs>
        <linearGradient id="sbg" x1="13" y1="13" x2="21" y2="21">
          <stop stopColor="#8a7cff" />
          <stop offset="1" stopColor="#3d9ff0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function DevtoolsApp({ embedded }: { embedded: boolean }) {
  const [picking, setPicking] = useState(false)
  const [hover, setHover] = useState<{ rect: DOMRect; name: string; dims: string }>()
  const [picked, setPicked] = useState<Picked>()
  const [, force] = useState(0)
  const connected = useStageboard((s) => s.connected)
  const activeJobs = useStageboard((s) => s.jobs.filter(isActiveJob).length)
  const pickingRef = useRef(picking)
  pickingRef.current = picking

  const stopPicking = useCallback(() => {
    setPicking(false)
    setHover(undefined)
    if (embedded) window.parent.postMessage({ source: MESSAGE_SOURCE, type: "pick-ended" }, "*")
  }, [embedded])

  useEffect(() => {
    if (!picking) return
    const onMove = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || isOwnNode(el)) return
      const rect = el.getBoundingClientRect()
      const chain = componentChain(el, 1)
      setHover({ rect, name: chain[0]?.name ?? el.tagName.toLowerCase(), dims: `${Math.round(rect.width)}×${Math.round(rect.height)}` })
    }
    const swallow = (e: Event) => {
      const el = e.target as Element
      if (isOwnNode(el)) return
      e.preventDefault()
      e.stopPropagation()
    }
    const onClick = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      if (!el || isOwnNode(el)) return
      e.preventDefault()
      e.stopPropagation()
      const target = describeElement(el)
      stopPicking()
      if (embedded) {
        window.parent.postMessage({ source: MESSAGE_SOURCE, type: "selected", target }, "*")
      } else {
        setPicked({ el, target })
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopPicking()
    }
    window.addEventListener("pointermove", onMove, true)
    window.addEventListener("pointerdown", swallow, true)
    window.addEventListener("mousedown", swallow, true)
    window.addEventListener("mouseup", swallow, true)
    window.addEventListener("click", onClick, true)
    window.addEventListener("keydown", onKey, true)
    document.documentElement.style.cursor = "crosshair"
    return () => {
      window.removeEventListener("pointermove", onMove, true)
      window.removeEventListener("pointerdown", swallow, true)
      window.removeEventListener("mousedown", swallow, true)
      window.removeEventListener("mouseup", swallow, true)
      window.removeEventListener("click", onClick, true)
      window.removeEventListener("keydown", onKey, true)
      document.documentElement.style.cursor = ""
    }
  }, [picking, embedded, stopPicking])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyC") {
        e.preventDefault()
        setPicked(undefined)
        setPicking((p) => !p)
      }
      if (e.key === "Escape" && !pickingRef.current) setPicked(undefined)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!embedded) return
    const onMessage = (e: MessageEvent) => {
      const data = e.data
      if (data?.source !== MESSAGE_SOURCE) return
      if (data.type === "pick") {
        setPicked(undefined)
        setPicking(Boolean(data.on))
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [embedded])

  useEffect(() => {
    if (!picked) return
    const onScroll = () => force((n) => n + 1)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [picked])

  const pickedRect = picked?.el.isConnected ? picked.el.getBoundingClientRect() : undefined

  return (
    <div className="sb-root">
      <div className="sb-layer">
        <JobOverlays />
        {pickedRect && (
          <div className="sb-selected" style={{ left: pickedRect.left, top: pickedRect.top, width: pickedRect.width, height: pickedRect.height }} />
        )}
        {picking && hover && (
          <>
            <div className="sb-hover" style={{ left: hover.rect.left, top: hover.rect.top, width: hover.rect.width, height: hover.rect.height }} />
            <div
              className="sb-hover-label"
              style={{ left: Math.max(4, hover.rect.left), top: hover.rect.top > 28 ? hover.rect.top - 24 : hover.rect.bottom + 4 }}
            >
              {hover.name}
              <span className="sb-dim">{hover.dims}</span>
            </div>
          </>
        )}
      </div>
      {!embedded && (
        <button
          className="sb-bubble"
          data-active={picking || Boolean(picked)}
          onClick={() => {
            if (picked) setPicked(undefined)
            else setPicking((p) => !p)
          }}
          title="Inspect (Alt+Shift+C)"
        >
          <Mark />
          <span className="sb-label">{picking ? "Pick an element" : "Inspect"}</span>
          {activeJobs > 0 ? <span className="sb-spinner" /> : <span className="sb-dot" data-on={connected} />}
          {activeJobs > 0 && <span className="sb-count">{activeJobs}</span>}
        </button>
      )}
      {picked && <Panel target={picked.target} onClose={() => setPicked(undefined)} />}
    </div>
  )
}

let mounted: { root: Root; host: HTMLElement } | undefined

export function mountDevtools(options: DevtoolsOptions = {}): () => void {
  if (typeof document === "undefined") return () => {}
  if (mounted) return () => {}
  startBridge(options.base)
  registerAngleProperty()
  const host = document.createElement("div")
  host.setAttribute(HOST_ATTR, "")
  document.body.appendChild(host)
  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = devtoolsCss
  shadow.appendChild(style)
  const container = document.createElement("div")
  shadow.appendChild(container)
  const root = createRoot(container)
  const embedded = options.embedded ?? new URLSearchParams(location.search).has("sb-embed")
  root.render(<DevtoolsApp embedded={embedded} />)
  mounted = { root, host }
  return () => {
    root.unmount()
    host.remove()
    mounted = undefined
  }
}

export function StageboardDevtools(props: DevtoolsOptions) {
  useLayoutEffect(() => mountDevtools(props), [])
  return null
}
