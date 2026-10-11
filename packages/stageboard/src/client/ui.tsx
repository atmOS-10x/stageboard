import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { devtoolsCss, Panel, startBridge, useStageboard } from "stageboard/react"
import type { ElementTarget } from "stageboard"
import { Canvas, type PageNode } from "./canvas"
import { uiCss } from "./styles"
import { resolveStory, type ClientEntry, type Loaders, type StoryModule } from "./types"

type UIOptions = { index: ClientEntry[]; loaders: Loaders; base: string }

type Route = { view: "canvas" } | { view: "story"; id: string }

const WIDTHS: { label: string; value?: number }[] = [
  { label: "Fill" },
  { label: "390", value: 390 },
  { label: "768", value: 768 },
  { label: "1280", value: 1280 },
  { label: "1440", value: 1440 },
]

function parseHash(): Route {
  const m = /^#\/story\/(.+)$/.exec(location.hash)
  if (m) return { view: "story", id: decodeURIComponent(m[1]) }
  return { view: "canvas" }
}

function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash)
  useEffect(() => {
    const on = () => setRoute(parseHash())
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  const go = useCallback((r: Route) => {
    location.hash = r.view === "story" ? `#/story/${encodeURIComponent(r.id)}` : "#/canvas"
  }, [])
  return [route, go]
}

function usePages(index: ClientEntry[], loaders: Loaders): PageNode[] {
  const [pages, setPages] = useState<PageNode[]>([])
  useEffect(() => {
    let cancelled = false
    const candidates = index.filter((s) => s.hasPage)
    const files = [...new Set(candidates.map((s) => s.file))]
    Promise.all(
      files.map(async (file) => {
        try {
          return { file, mod: (await loaders[file]()) as StoryModule }
        } catch (e) {
          console.warn(`[stageboard] could not load ${file}`, e)
          return { file, mod: undefined }
        }
      }),
    ).then((mods) => {
      if (cancelled) return
      const out: PageNode[] = []
      for (const entry of candidates) {
        const mod = mods.find((m) => m.file === entry.file)?.mod
        if (!mod) continue
        const page = resolveStory(entry, mod).parameters.page
        if (page?.route) out.push({ entry, page })
      }
      setPages(out)
    })
    return () => {
      cancelled = true
    }
  }, [index, loaders])
  return pages
}

function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
      <rect x="13" y="13" width="8" height="8" rx="4" fill="#7c6cff" />
    </svg>
  )
}

function Sidebar({ index, active, onPick }: { index: ClientEntry[]; active?: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState("")
  const groups = useMemo(() => {
    const filtered = index.filter((s) => !q || `${s.title} ${s.name}`.toLowerCase().includes(q.toLowerCase()))
    const out = new Map<string, Map<string, ClientEntry[]>>()
    for (const s of filtered) {
      const parts = s.title.split("/")
      const group = parts.length > 1 ? parts[0] : "Stories"
      const comp = parts.length > 1 ? parts.slice(1).join(" / ") : parts[0]
      if (!out.has(group)) out.set(group, new Map())
      const g = out.get(group)!
      if (!g.has(comp)) g.set(comp, [])
      g.get(comp)!.push(s)
    }
    return out
  }, [index, q])
  return (
    <aside className="sbu-side">
      <input className="sbu-search" placeholder="Search stories" value={q} onChange={(e) => setQ(e.target.value)} />
      {[...groups].map(([group, comps]) => (
        <div className="sbu-group" key={group}>
          <div className="sbu-group-title">{group}</div>
          {[...comps].map(([comp, stories]) => (
            <div key={comp}>
              <div className="sbu-comp">{comp}</div>
              {stories.map((s) => (
                <button key={s.id} className="sbu-story" data-on={active === s.id} onClick={() => onPick(s.id)}>
                  {s.name}
                  {s.hasPage && <span className="sbu-badge">page</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      ))}
      {index.length === 0 && <p className="sbu-dim" style={{ padding: 8 }}>No stories found. Check the <span className="sbu-mono">stories</span> globs in stageboard.config.ts.</p>}
    </aside>
  )
}

function App({ index, loaders, base }: UIOptions) {
  const [route, go] = useRoute()
  const [width, setWidth] = useState<number | undefined>()
  const [theme, setTheme] = useState<"light" | "dark" | undefined>()
  const [inspecting, setInspecting] = useState(false)
  const [target, setTarget] = useState<ElementTarget>()
  const frames = useRef(new Map<string, HTMLIFrameElement>())
  const storyFrame = useRef<HTMLIFrameElement>(null)
  const pages = usePages(index, loaders)
  const activeJobs = useStageboard((s) => s.jobs.filter((j) => j.status === "running" || j.status === "queued").length)
  const connected = useStageboard((s) => s.connected)

  const frameUrl = useCallback(
    (id: string) => {
      const p = new URLSearchParams({ story: id, "sb-embed": "1" })
      if (theme) p.set("sb-theme", theme)
      return `${base}/frame.html?${p}`
    },
    [base, theme],
  )

  const allFrames = useCallback(() => {
    const list = [...frames.current.values()]
    if (storyFrame.current) list.push(storyFrame.current)
    return list
  }, [])

  useEffect(() => {
    for (const f of allFrames()) f.contentWindow?.postMessage({ source: "stageboard", type: "pick", on: inspecting }, "*")
  }, [inspecting, allFrames, route])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard") return
      if (e.data.type === "selected") {
        setTarget(e.data.target)
        setInspecting(false)
      }
      if (e.data.type === "pick-ended") setInspecting(false)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyC") setInspecting((v) => !v)
      if (e.key === "Escape") setInspecting(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const current = route.view === "story" ? index.find((s) => s.id === route.id) : undefined

  return (
    <div className="sbu">
      <header className="sbu-top">
        <div className="sbu-brand">
          <Mark /> stageboard
        </div>
        <div className="sbu-tabs">
          <button data-on={route.view === "canvas"} onClick={() => go({ view: "canvas" })}>
            Site map
          </button>
          <button data-on={route.view === "story"} onClick={() => current ? undefined : index[0] && go({ view: "story", id: index[0].id })}>
            Catalog
          </button>
        </div>
        <div className="sbu-spacer" />
        {activeJobs > 0 && <span className="sbu-dim">{activeJobs} agent{activeJobs === 1 ? "" : "s"} working…</span>}
        <button className="sbu-btn" data-on={inspecting} onClick={() => setInspecting((v) => !v)} title="Alt+Shift+C">
          Inspect
        </button>
        <button className="sbu-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : t === "light" ? undefined : "dark"))}>
          Theme: {theme ?? "story"}
        </button>
        <span title={connected ? "Bridge connected" : "Bridge offline"} style={{ width: 8, height: 8, borderRadius: 99, background: connected ? "#2fb585" : "#6f6f7a" }} />
      </header>
      <Sidebar index={index} active={current?.id} onPick={(id) => go({ view: "story", id })} />
      <main className="sbu-main">
        {route.view === "canvas" &&
          (pages.length ? (
            <Canvas
              nodes={pages}
              frameUrl={frameUrl}
              inspecting={inspecting}
              onOpen={(id) => go({ view: "story", id })}
              registerFrame={(id, el) => (el ? frames.current.set(id, el) : frames.current.delete(id))}
            />
          ) : (
            <div className="sbu-empty">
              <div>
                <p style={{ fontSize: 15, color: "#ededf0" }}>No pages on the site map yet</p>
                <p>
                  Add <span className="sbu-mono">parameters: {"{ page: { route: \"/\", links: [\"/pricing\"] } }"}</span> to a story to place it here.
                </p>
              </div>
            </div>
          ))}
        {route.view === "story" && current && (
          <div className="sbu-story-view">
            <div className="sbu-toolbar">
              <span className="sbu-title">{current.title}</span>
              <span className="sbu-dim">/ {current.name}</span>
              <span className="sbu-spacer" />
              {WIDTHS.map((w) => (
                <button key={w.label} className="sbu-btn" data-on={width === w.value} onClick={() => setWidth(w.value)}>
                  {w.label}
                </button>
              ))}
              <button className="sbu-btn" onClick={() => window.open(frameUrl(current.id).replace("sb-embed=1&", ""), "_blank")}>
                Open
              </button>
              <button
                className="sbu-btn"
                title="Copy screenshot command"
                onClick={() => navigator.clipboard?.writeText(`npx stageboard shot ${current.id}${width ? ` --width ${width}` : ""}`)}
              >
                Copy shot cmd
              </button>
            </div>
            <div className="sbu-stage">
              <iframe
                key={`${current.id}-${theme}`}
                ref={storyFrame}
                className="sbu-frame"
                src={frameUrl(current.id)}
                title={current.id}
                style={{ width: width ?? "100%" }}
                onLoad={() => storyFrame.current?.contentWindow?.postMessage({ source: "stageboard", type: "pick", on: inspecting }, "*")}
              />
            </div>
          </div>
        )}
        {route.view === "story" && !current && <div className="sbu-empty">Pick a story on the left.</div>}
      </main>
      <aside className="sbu-inspector">
        {target && (
          <div className="sb-root">
            <Panel target={target} onClose={() => setTarget(undefined)} docked={false} />
          </div>
        )}
      </aside>
    </div>
  )
}

export function mountUI(container: HTMLElement | null, options: UIOptions) {
  if (!container) return
  const style = document.createElement("style")
  style.textContent = uiCss + devtoolsCss
  document.head.appendChild(style)
  document.body.classList.add("sb-ui")
  startBridge(options.base)
  createRoot(container).render(<App {...options} />)
}
