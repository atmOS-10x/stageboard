import { Component, createElement, useEffect, type ComponentType, type CSSProperties, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { describeRegion, installSketch, mountDevtools, setVariantOverrides, startBridge } from "@atmos.build/stageboard/react"
import type { Decorator, FlowAction, StoryContext } from "@atmos.build/stageboard"
import { fillRoute, matchRoute, type RouteParams } from "./routes"
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
  __STAGEBOARD_TITLE__?: string
  __STAGEBOARD_PATH__?: string
  __STAGEBOARD_PARAMS__?: RouteParams
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

// A forced theme has to win over the app's own theme provider (next-themes and the like), which follows
// prefers-color-scheme and rewrites <html class>: answer the media query with the theme and keep the class on.
function applyTheme(theme: string | undefined) {
  if (theme !== "light" && theme !== "dark") return
  const root = document.documentElement
  const matchMedia = window.matchMedia.bind(window)
  window.matchMedia = (query: string) => {
    const scheme = /prefers-color-scheme:\s*(dark|light)/.exec(query)
    if (!scheme) return matchMedia(query)
    return {
      matches: scheme[1] === theme,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    } as MediaQueryList
  }
  const set = () => {
    if (root.classList.contains(theme) && !root.classList.contains(theme === "dark" ? "light" : "dark") && root.style.colorScheme === theme) return
    root.classList.remove("light", "dark")
    root.classList.add(theme)
    root.style.colorScheme = theme
    root.dataset.theme = theme
  }
  set()
  new MutationObserver(set).observe(root, { attributes: true, attributeFilter: ["class", "style"] })
}

const LAYOUT_STYLE: Record<string, CSSProperties> = {
  centered: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, boxSizing: "border-box" },
  padded: { padding: 24, boxSizing: "border-box" },
  fullscreen: {},
}

;(window as unknown as Record<string, unknown>).__stageboard_describeRegion = describeRegion

let forwarding = false
// A live page (the viewer handed it the keyboard) keeps its keys; only Escape goes back to hand control back.
let live = false

function forwardShortcuts() {
  if (forwarding) return
  forwarding = true
  window.addEventListener("message", (e) => {
    if (e.source === window.parent && e.data?.source === "stageboard" && e.data.type === "live") live = Boolean(e.data.on)
  })
  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (live) {
      if (e.key === "Escape") window.parent?.postMessage({ source: "stageboard", type: "key", key: e.key }, "*")
      return
    }
    if (e.defaultPrevented) return
    const el = e.target as HTMLElement | null
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
    if (!["a", "A", "s", "S", "Escape", "ArrowLeft", "ArrowRight"].includes(e.key)) return
    window.parent?.postMessage({ source: "stageboard", type: "key", key: e.key }, "*")
  })
}

// Flow actions: what the user does on a screen, played back with a visible cursor in the viewer, or instantly
// for `stageboard flow shot`. Events are dispatched on the element, so it works while the frame is inert.
export type PlayResult = { index: number; ok: boolean; error?: string }

const CLICKABLE = "button, a, [role=button], [role=tab], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=option], [role=switch], [role=checkbox], [role=radio], [role=link], [role=combobox], label, summary, input, select, textarea, [tabindex]"
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))

function findTarget(target: string): HTMLElement | undefined {
  try {
    if (/^[#.[]|[>=]/.test(target)) {
      const el = document.querySelector<HTMLElement>(target)
      if (el) return el
    }
  } catch {}
  const want = target.trim().toLowerCase().replace(/^[„“"'«]|[“”"'»]$/g, "")
  const visible = (el: HTMLElement) => el.getClientRects().length > 0 && !el.closest("[data-stageboard-cursor], [aria-hidden=true]")
  const own = (el: HTMLElement) => {
    const label = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : undefined
    return [el.getAttribute("aria-label"), (el as HTMLInputElement).placeholder, label, el.innerText, (el as HTMLInputElement).value]
      .filter(Boolean)
      .map((t) => t!.trim().toLowerCase())
  }
  const clickable = [...document.querySelectorAll<HTMLElement>(CLICKABLE)].filter(visible)
  // The innermost match: a list or toolbar that contains the item is clickable too, but it is not what was meant.
  const innermost = (list: HTMLElement[]) => list.find((el) => !list.some((o) => o !== el && el.contains(o)))
  const hit =
    innermost(clickable.filter((el) => own(el).includes(want))) ??
    innermost(clickable.filter((el) => own(el).some((t) => t.split("\n").map((l) => l.trim()).includes(want)))) ??
    innermost(clickable.filter((el) => own(el).some((t) => t.includes(want))))
  if (hit?.tagName === "LABEL") {
    // A label stands for its field; libraries like Radix Select point it at a hidden native control, so then take
    // the visible control labelled by it, or next to it.
    const label = hit as HTMLLabelElement
    const control = label.control as HTMLElement | null
    if (control && visible(control)) return control
    const byLabel = label.id ? document.querySelector<HTMLElement>(`[aria-labelledby~="${CSS.escape(label.id)}"]`) : null
    if (byLabel && visible(byLabel)) return byLabel
    const near = [...(label.parentElement?.querySelectorAll<HTMLElement>(CLICKABLE) ?? [])].find((el) => el !== label && !label.contains(el) && visible(el))
    return near ?? label
  }
  if (hit) return hit
  // Any element showing exactly that text, as deep as possible, or the clickable thing around it.
  const exact = [...document.body.querySelectorAll<HTMLElement>("*")].filter((el) => visible(el) && el.innerText?.trim().toLowerCase() === want).pop()
  return exact ? (exact.closest<HTMLElement>(CLICKABLE) ?? exact) : undefined
}

async function waitForTarget(target: string, ms = 3000): Promise<HTMLElement | undefined> {
  const until = Date.now() + ms
  for (;;) {
    const el = findTarget(target)
    if (el || Date.now() > until) return el
    await sleep(120)
  }
}

let cursor: HTMLDivElement | undefined
function showCursor(x: number, y: number, animate: boolean) {
  if (!cursor) {
    cursor = document.createElement("div")
    cursor.setAttribute("data-stageboard-cursor", "")
    cursor.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5 19.5 12l-6.6 1.4L9.6 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    Object.assign(cursor.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" })
    cursor.style.transform = `translate(${innerWidth / 2}px, ${innerHeight * 0.75}px)`
    document.body.appendChild(cursor)
  }
  cursor.style.transition = animate ? "transform .55s cubic-bezier(.3,.7,.2,1)" : "none"
  cursor.style.transform = `translate(${x - 4}px, ${y - 3}px)`
}

function ripple(x: number, y: number) {
  const r = document.createElement("div")
  r.setAttribute("data-stageboard-cursor", "")
  Object.assign(r.style, {
    position: "fixed", left: `${x - 18}px`, top: `${y - 18}px`, width: "36px", height: "36px", borderRadius: "999px", zIndex: "2147483646",
    pointerEvents: "none", background: "rgba(141,122,246,.35)", boxShadow: "0 0 0 2px rgba(141,122,246,.8)", transition: "transform .45s ease, opacity .45s ease", transform: "scale(.3)",
  })
  document.body.appendChild(r)
  requestAnimationFrame(() => Object.assign(r.style, { transform: "scale(1.4)", opacity: "0" }))
  setTimeout(() => r.remove(), 500)
}

function pointerAt(el: HTMLElement, type: string, x: number, y: number, buttons: number) {
  const init = { bubbles: !/enter|leave/.test(type), cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons, view: window }
  el.dispatchEvent(type.startsWith("pointer") ? new PointerEvent(type, { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true }) : new MouseEvent(type, init))
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value)
}

function key(el: Element, type: "keydown" | "keyup", k: string) {
  el.dispatchEvent(new KeyboardEvent(type, { key: k, code: k.length === 1 ? `Key${k.toUpperCase()}` : k, bubbles: true, cancelable: true, composed: true }))
}

let playing = 0

export async function playActions(actions: FlowAction[], options: { animate: boolean; onStep?: (index: number) => void }): Promise<PlayResult[]> {
  const run = ++playing
  const { animate } = options
  const results: PlayResult[] = []
  let focused: HTMLElement | undefined
  for (const [index, a] of actions.entries()) {
    if (run !== playing) break
    options.onStep?.(index)
    try {
      if (a.do === "wait") {
        await sleep(Number(a.text) || 500)
        results.push({ index, ok: true })
        continue
      }
      if (a.do === "press") {
        const el = (focused ?? document.activeElement ?? document.body) as HTMLElement
        key(el, "keydown", a.text || "Enter")
        if ((a.text || "Enter") === "Enter" && el instanceof HTMLInputElement) el.form?.requestSubmit()
        key(el, "keyup", a.text || "Enter")
        await sleep(animate ? 450 : 250)
        results.push({ index, ok: true })
        continue
      }
      const el = a.target ? await waitForTarget(a.target) : a.do === "type" ? focused : undefined
      if (!el) throw new Error(a.target ? `nothing on the screen matches “${a.target}”` : "no field to type into")
      el.scrollIntoView({ block: a.do === "scroll" ? "start" : "nearest", inline: "nearest", behavior: animate && a.do === "scroll" ? "smooth" : "instant" })
      if (a.do === "scroll") {
        await sleep(animate ? 600 : 150)
        results.push({ index, ok: true })
        continue
      }
      const r = el.getBoundingClientRect()
      const x = r.left + Math.min(r.width / 2, 40)
      const y = r.top + r.height / 2
      if (animate) {
        showCursor(x, y, true)
        await sleep(600)
      }
      pointerAt(el, "pointerover", x, y, 0)
      pointerAt(el, "pointerenter", x, y, 0)
      pointerAt(el, "mouseover", x, y, 0)
      pointerAt(el, "pointermove", x, y, 0)
      pointerAt(el, "mousemove", x, y, 0)
      if (a.do === "click" || a.do === "type") {
        if (animate) ripple(x, y)
        pointerAt(el, "pointerdown", x, y, 1)
        pointerAt(el, "mousedown", x, y, 1)
        try {
          el.focus({ preventScroll: true })
        } catch {}
        pointerAt(el, "pointerup", x, y, 0)
        pointerAt(el, "mouseup", x, y, 0)
        pointerAt(el, "click", x, y, 0)
        focused = el
      }
      if (a.do === "type") {
        const field = (el.matches("input, textarea") ? el : el.querySelector("input, textarea")) as HTMLInputElement | HTMLTextAreaElement | null
        if (!field) throw new Error(`“${a.target}” is not a field to type into`)
        const text = a.text ?? ""
        let value = ""
        setValue(field, "")
        for (const ch of text) {
          value += ch
          key(field, "keydown", ch)
          setValue(field, value)
          field.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }))
          key(field, "keyup", ch)
          if (animate) await sleep(45)
        }
        field.dispatchEvent(new Event("change", { bubbles: true }))
        focused = field
      }
      await sleep(animate ? 500 : 300)
      results.push({ index, ok: true })
    } catch (e) {
      results.push({ index, ok: false, error: (e as Error).message })
      break
    }
  }
  if (animate && run === playing) setTimeout(() => run === playing && cursor && (cursor.style.opacity = "0"), 900)
  return results
}

;(window as unknown as Record<string, unknown>).__stageboard_play = (actions: FlowAction[]) => playActions(actions, { animate: false })

function listenActions() {
  window.addEventListener("message", async (e) => {
    if (e.source !== window.parent || e.data?.source !== "stageboard") return
    if (e.data.type === "play-stop") {
      playing++
      cursor?.remove()
      cursor = undefined
      return
    }
    if (e.data.type !== "play") return
    const id = e.data.id
    if (cursor) cursor.style.opacity = "1"
    const results = await playActions(e.data.actions ?? [], {
      animate: true,
      onStep: (index) => window.parent?.postMessage({ source: "stageboard", type: "play-step", id, index }, "*"),
    })
    window.parent?.postMessage({ source: "stageboard", type: "play-done", id, results }, "*")
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
  installSketch(options.base ?? "/__stageboard")
  if (!shot) {
    startBridge(options.base)
    mountDevtools({ base: options.base, embedded: params.has("sb-embed") })
    if (params.has("sb-embed")) {
      forwardShortcuts()
      listenFreeze()
      listenActions()
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
    const page = parameters.page
    w.__STAGEBOARD_ROUTE__ = page?.route
    w.__STAGEBOARD_TITLE__ = page?.title
    // What next/navigation's useParams, usePathname and useSearchParams answer: the page's params, from its path if
    // only that is given, and the path from the route with the params filled in otherwise.
    const pageParams = page?.params ?? (page?.route && page.path ? matchRoute(page.route, page.path) : undefined) ?? {}
    w.__STAGEBOARD_PARAMS__ = pageParams
    w.__STAGEBOARD_PATH__ = page?.path ?? (page?.route ? fillRoute(page.route, pageParams) : undefined)
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
      layout === "fullscreen" ? {} : layout === "centered" ? { display: "inline-block", maxWidth: "100%" } : {}
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
