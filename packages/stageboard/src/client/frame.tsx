import { Component, createElement, useEffect, type ComponentType, type CSSProperties, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { mountDevtools, setVariantOverrides, startBridge } from "stageboard/react"
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
      window.parent?.postMessage({ source: "stageboard", type: "ready", height: document.documentElement.scrollHeight }, "*")
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
