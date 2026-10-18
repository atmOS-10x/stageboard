import { Component, createElement, useEffect, type ComponentType, type CSSProperties, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { describeRegion, mountDevtools, setVariantOverrides, startBridge } from "stageboard/react"
import type { Decorator, StoryContext } from "stageboard"
import { resolveStory, type ClientEntry, type Loaders, type PreviewModule, type StoryModule } from "./types"

type FrameOptions = {
  index: ClientEntry[]
  loaders: Loaders
  preview?: PreviewModule
  base?: string
}

type Win = Window & {
  __STAGEBOARD_READY__?: boolean
  __STAGEBOARD_ERROR__?: string
  __STAGEBOARD_LAYOUT__?: string
  __STAGEBOARD_ROUTE__?: string
}

const w = window as Win

class StageboardErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    w.__STAGEBOARD_ERROR__ = `${error.message}\n${error.stack ?? ""}`
    window.parent?.postMessage({ source: "stageboard", type: "error", message: error.message }, "*")
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ margin: 16, padding: 16, borderRadius: 8, background: "#2a1215", color: "#ffb4a8", font: "12px/1.5 ui-monospace, monospace", whiteSpace: "pre-wrap" }}>
          {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </pre>
      )
    }
    return this.props.children
  }
}

function waitForImages(timeout = 5000): Promise<void> {
  const pending = Array.from(document.images).filter((img) => !img.complete)
  if (!pending.length) return Promise.resolve()
  return Promise.race([
    Promise.all(pending.map((img) => new Promise((r) => ((img.onload = r), (img.onerror = r))))).then(() => {}),
    new Promise<void>((r) => setTimeout(r, timeout)),
  ])
}

function StageboardReady({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false
    const settle = async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      await document.fonts?.ready
      await waitForImages()
      await new Promise((r) => setTimeout(r, 120))
      if (cancelled) return
      w.__STAGEBOARD_READY__ = true
      const usedVariants = Array.from(((globalThis as Record<string, unknown>).__STAGEBOARD_USED__ as Set<string> | undefined) ?? [])
      window.parent?.postMessage({ source: "stageboard", type: "ready", height: document.documentElement.scrollHeight, usedVariants }, "*")
    }
    void settle()
    return () => {
      cancelled = true
    }
  }, [])
  return <>{children}</>
}

function applyTheme(theme: string | undefined) {
  if (!theme) return
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(theme)
  root.style.colorScheme = theme
  root.dataset.theme = theme
}

const LAYOUT_STYLE: Record<string, CSSProperties> = {
  centered: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, boxSizing: "border-box" },
  padded: { padding: 24, boxSizing: "border-box" },
  fullscreen: {},
}

;(window as unknown as Record<string, unknown>).__stageboard_describeRegion = describeRegion

let forwarding = false

function forwardShortcuts() {
  if (forwarding) return
  forwarding = true
  window.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
    const el = e.target as HTMLElement | null
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
    if (e.key !== "a" && e.key !== "A" && e.key !== "Escape") return
    window.parent?.postMessage({ source: "stageboard", type: "key", key: e.key }, "*")
  })
}

const FREEZE_CSS = "*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}"
const SCROLL_KEYS = new Set([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"])
let frozen: { style: HTMLStyleElement; videos: HTMLVideoElement[] } | undefined

function setFrozen(on: boolean, scroll?: { x: number; y: number }) {
  if (on && !frozen) {
    const style = document.createElement("style")
    style.textContent = FREEZE_CSS
    document.head.appendChild(style)
    const videos = Array.from(document.querySelectorAll("video")).filter((v) => !v.paused)
    videos.forEach((v) => v.pause())
    frozen = { style, videos }
  } else if (!on && frozen) {
    frozen.style.remove()
    frozen.videos.forEach((v) => void v.play().catch(() => {}))
    frozen = undefined
  }
  if (on && scroll) window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" })
}

let freezing = false

function listenFreeze() {
  if (freezing) return
  freezing = true
  window.addEventListener("message", (e) => {
    if (e.data?.source === "stageboard" && e.data.type === "freeze") setFrozen(Boolean(e.data.on), e.data.scroll)
  })
  const block = (e: Event) => {
    if (!frozen) return
    if (e instanceof KeyboardEvent && !SCROLL_KEYS.has(e.key)) return
    e.preventDefault()
  }
  for (const type of ["wheel", "touchmove", "keydown"]) window.addEventListener(type, block, { capture: true, passive: false })
}

export async function renderFrame(container: HTMLElement | null, options: FrameOptions) {
  if (!container) return
  const params = new URLSearchParams(location.search)
  const id = params.get("story")
  const shot = params.has("sb-shot")
  const holder = container as HTMLElement & { __sbRoot?: ReturnType<typeof createRoot> }
  const root = (holder.__sbRoot ??= createRoot(container))
  if (!shot) {
    startBridge(options.base)
    mountDevtools({ base: options.base, embedded: params.has("sb-embed") })
    if (params.has("sb-embed")) {
      forwardShortcuts()
      listenFreeze()
    }
  }
  const entry = options.index.find((s) => s.id === id)
  if (!entry) {
    w.__STAGEBOARD_ERROR__ = `Unknown story "${id}"`
    root.render(<p style={{ font: "14px system-ui", padding: 24 }}>Unknown story: {id}</p>)
    return
  }
  try {
    const mod = (await options.loaders[entry.file]()) as StoryModule
    const resolved = resolveStory(entry, mod, options.preview)
    const { meta, story, parameters } = resolved
    if (parameters.variants) setVariantOverrides(parameters.variants)
    applyTheme(params.get("sb-theme") ?? parameters.theme)
    const layout = parameters.layout ?? (parameters.page ? "fullscreen" : "centered")
    w.__STAGEBOARD_LAYOUT__ = layout
    w.__STAGEBOARD_ROUTE__ = parameters.page?.route
    if (parameters.background) document.body.style.background = parameters.background
    document.body.style.margin = "0"
    const args = { ...(meta.args ?? {}), ...(story.args ?? {}) } as Record<string, unknown>
    const context: StoryContext = { id: entry.id, title: entry.title, name: entry.name, args, parameters }
    const StageboardStory: ComponentType = () =>
      story.render ? <>{story.render(args as never, context as never)}</> : meta.component ? createElement(meta.component as ComponentType, args) : null
    const decorators = [...(story.decorators ?? []), ...(meta.decorators ?? []), ...(options.preview?.decorators ?? [])] as Decorator[]
    const StageboardDecorated = decorators.reduce<ComponentType>((Inner, decorate) => {
      const StageboardDecorator: ComponentType = () => <>{decorate(Inner, context)}</>
      return StageboardDecorator
    }, StageboardStory)
    const stageStyle: CSSProperties =
      layout === "fullscreen" ? {} : layout === "centered" ? { display: "inline-block", width: parameters.viewport?.width } : {}
    root.render(
      <StageboardErrorBoundary>
        <StageboardReady>
          <div style={LAYOUT_STYLE[layout]}>
            <div id="sb-stage" style={stageStyle}>
              <StageboardDecorated />
            </div>
          </div>
        </StageboardReady>
      </StageboardErrorBoundary>,
    )
  } catch (e) {
    const error = e as Error
    w.__STAGEBOARD_ERROR__ = `${error.message}\n${error.stack ?? ""}`
    root.render(<pre style={{ padding: 16, color: "crimson", whiteSpace: "pre-wrap" }}>{error.stack ?? error.message}</pre>)
  }
}
