import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { devtoolsCss, Panel, startBridge, useStageboard } from "stageboard/react"
import type { ElementTarget } from "stageboard"
import { AnnotateProvider, AnnotationLayer, useDismissedPins, type Draft, type Surface } from "./annotate"
import { fetchUsedVariants, storyUrl } from "./api"
import { Canvas, SiteMapLoading, type PageNode } from "./canvas"
import { Composer } from "./composer"
import { clearDraft, readDraft, type StoredDraft } from "./draft-store"
import { Gallery } from "./gallery"
import { AnnotateIcon, InspectIcon, LayersIcon, SketchIcon } from "./icons"
import { clearSketch, SketchLayer } from "./sketch"
import { PinDetails } from "./pins"
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

function usePages(index: ClientEntry[], loaders: Loaders): { pages: PageNode[]; loading: boolean } {
  const [pages, setPages] = useState<PageNode[]>([])
  const [loading, setLoading] = useState(() => index.some((s) => s.hasPage))
  useEffect(() => {
    let cancelled = false
    const candidates = index.filter((s) => s.hasPage)
    setLoading(candidates.length > 0)
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
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [index, loaders])
  return { pages, loading }
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

function isEditable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  return Boolean(node && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)))
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
  const [inspecting, setInspectingState] = useState(false)
  const [annotating, setAnnotatingState] = useState(false)
  const [sketching, setSketching] = useState(false)
  const [mapSketching, setMapSketching] = useState(false)
  const [draft, setDraft] = useState<Draft>()
  const [restore, setRestore] = useState<StoredDraft | undefined>(readDraft)
  const [openPin, setOpenPin] = useState<string>()
  const [dismissed, dismiss] = useDismissedPins()
  const [gallery, setGallery] = useState(false)
  const [used, setUsed] = useState<Record<string, string[]>>({})
  const [target, setTarget] = useState<ElementTarget>()
  const frames = useRef(new Map<string, HTMLIFrameElement>())
  const storyFrame = useRef<HTMLIFrameElement>(null)
  const { pages, loading: pagesLoading } = usePages(index, loaders)
  const activeJobs = useStageboard((s) => s.jobs.filter((j) => j.status === "running" || j.status === "queued").length)
  const connected = useStageboard((s) => s.connected)
  const variantFiles = useStageboard((s) => s.serverVariants)
  const openJob = useStageboard((s) => (openPin ? s.jobs.find((j) => j.id === openPin) : undefined))

  const setInspecting = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setInspectingState((v) => {
      const on = typeof next === "function" ? next(v) : next
      if (on) setAnnotatingState(false)
      return on
    })
  }, [])

  const setAnnotating = useCallback((next: boolean | ((v: boolean) => boolean)) => {
    setAnnotatingState((v) => {
      const on = typeof next === "function" ? next(v) : next
      if (on) {
        setInspectingState(false)
        setSketching(false)
        setMapSketching(false)
      } else setDraft(undefined)
      return on
    })
  }, [])

  const draftRef = useRef(draft)
  draftRef.current = draft

  const keyAction = useCallback(
    (key: string) => {
      if (draftRef.current) {
        if (key === "Escape") setDraft(undefined)
        else document.querySelector<HTMLTextAreaElement>(".sbu-composer-input")?.focus()
        return
      }
      if (key === "a" || key === "A") setAnnotating((v) => !v)
      if (key === "s" || key === "S") {
        setAnnotatingState(false)
        if (parseHash().view === "story") setSketching((v) => !v)
        else setMapSketching((v) => !v)
      }
      if (key === "Escape") {
        setInspecting(false)
        setAnnotating(false)
      }
    },
    [setAnnotating, setInspecting],
  )

  const frameUrl = useCallback(
    (id: string) => {
      const p = new URLSearchParams({ story: id, "sb-embed": "1" })
      if (theme) p.set("sb-theme", theme)
      return `${base}/frame.html?${p}`
    },
    [base, theme],
  )

  const selectionKey = useStageboard((s) => JSON.stringify(s.selections))
  const thumbUrl = useCallback(
    (id: string) => `${base}/api/thumb/${id}.jpg?s=${encodeURIComponent(selectionKey).slice(0, 200)}`,
    [base, selectionKey],
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
      if (e.data.type === "key") keyAction(String(e.data.key))
      if (e.data.type === "ready" && e.source && e.source === storyFrame.current?.contentWindow) {
        const id = new URLSearchParams(storyFrame.current.src.split("?")[1]).get("story")
        if (id) setUsed((u) => ({ ...u, [id]: (e.data.usedVariants as string[] | undefined) ?? [] }))
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [keyAction, setInspecting])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyC") setInspecting((v) => !v)
      if (e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return
      if (["a", "A", "s", "S"].includes(e.key) || (e.key === "Escape" && !sketching && !mapSketching)) keyAction(e.key)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keyAction, setInspecting, sketching, mapSketching])

  useEffect(() => {
    fetchUsedVariants(base).then((known) => setUsed((u) => ({ ...known, ...u })))
  }, [base])

  const routeKey = JSON.stringify(route)
  const lastRoute = useRef(routeKey)
  useEffect(() => {
    if (lastRoute.current === routeKey) return
    lastRoute.current = routeKey
    setRestore(undefined)
    setDraft(undefined)
    setOpenPin(undefined)
    setSketching(false)
    setMapSketching(false)
  }, [routeKey])

  const begin = useCallback((next: Draft) => {
    setRestore(undefined)
    setDraft(next)
  }, [])

  useEffect(() => {
    if (!draft && !restore) clearDraft()
  }, [draft, restore])

  useEffect(() => {
    if (!draft) return
    const frame = draft.surface.frame
    const post = (on: boolean) => frame?.()?.contentWindow?.postMessage({ source: "stageboard", type: "freeze", on, scroll: on ? draft.scroll : undefined }, "*")
    post(true)
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source === "stageboard" && e.data.type === "ready" && e.source && e.source === frame?.()?.contentWindow) post(true)
    }
    window.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("message", onMessage)
      post(false)
    }
  }, [draft?.surface, draft?.scroll])

  const onSent = useCallback(() => {
    const sent = draftRef.current
    if (sent?.sketch) {
      clearSketch(sent.surface.storyId)
      setSketching(false)
    }
    setDraft(undefined)
  }, [])

  const current = route.view === "story" ? index.find((s) => s.id === route.id) : undefined
  const storySurface = useMemo<Surface | undefined>(
    () =>
      current && {
        key: `story:${current.id}`,
        storyId: current.id,
        title: current.name,
        url: storyUrl(frameUrl(current.id)),
        frame: () => storyFrame.current,
        scrollsFrame: true,
      },
    [current, frameUrl],
  )
  const componentStories = useMemo(() => index.filter((s) => !s.hasPage), [index])
  const galleryRows = current
    ? (used[current.id] ?? []).filter((id) => variantFiles.some((v) => v.of === id)).length
    : 0

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
        <button className="sbu-btn" data-on={inspecting} onClick={() => setInspecting((v) => !v)} title="Inspect an element · Alt+Shift+C">
          <InspectIcon size={13} />
          Inspect
        </button>
        {route.view === "canvas" && (
          <button
            className="sbu-btn"
            data-on={mapSketching}
            aria-pressed={mapSketching}
            onClick={() => {
              setAnnotatingState(false)
              setMapSketching((v) => !v)
            }}
            title="Draw on the site map: link screens with arrows, leave notes, mark up pages · S"
          >
            <SketchIcon size={13} />
            Sketch
            <span className="sbu-key">S</span>
          </button>
        )}
        <button className="sbu-btn" data-on={annotating} aria-pressed={annotating} onClick={() => setAnnotating((v) => !v)} title="Drag over a page to annotate · A">
          <AnnotateIcon size={13} />
          Annotate
          <span className="sbu-key">A</span>
        </button>
        <button className="sbu-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : t === "light" ? undefined : "dark"))}>
          Theme: {theme ?? "story"}
        </button>
        {!connected && <span className="sbu-dim" title="Start it with stageboard dev">Bridge offline</span>}
      </header>
      <Sidebar index={index} active={current?.id} onPick={(id) => go({ view: "story", id })} />
      <AnnotateProvider base={base} active={annotating} draft={draft} restore={restore} onBegin={begin} openPin={openPin} onTogglePin={setOpenPin} dismissed={dismissed}>
      <main className="sbu-main" data-annotating={annotating}>
        {route.view === "canvas" &&
          (pagesLoading && !pages.length ? (
            <SiteMapLoading entries={index.filter((s) => s.hasPage)} />
          ) : pages.length ? (
            <Canvas
              nodes={pages}
              frameUrl={frameUrl}
              thumbUrl={thumbUrl}
              inspecting={inspecting}
              annotating={annotating}
              sketching={mapSketching}
              onSketchExit={() => setMapSketching(false)}
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
              <button className="sbu-btn" data-on={gallery} aria-pressed={gallery} onClick={() => setGallery((v) => !v)} title="Show every variant side by side">
                <LayersIcon size={13} />
                Show variants
                {galleryRows > 0 && <span className="sbu-count">{galleryRows}</span>}
              </button>
              {!gallery && (
                <button
                  className="sbu-btn"
                  data-on={sketching}
                  aria-pressed={sketching}
                  onClick={() => {
                    setAnnotatingState(false)
                    setDraft(undefined)
                    setSketching((v) => !v)
                  }}
                  title="Move, resize and retype things, draw, drop in components, then let the agent build it · S"
                >
                  <SketchIcon size={13} />
                  Sketch
                  <span className="sbu-key">S</span>
                </button>
              )}
              <span className="sbu-tool-gap" />
              {!gallery && WIDTHS.map((w) => (
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
            <div className="sbu-stage" data-hidden={gallery}>
              <div className="sbu-frame-wrap" style={{ width: width ?? "100%" }}>
                <iframe
                  key={`${current.id}-${theme}`}
                  ref={storyFrame}
                  className="sbu-frame"
                  src={frameUrl(current.id)}
                  title={current.id}
                  onLoad={() => storyFrame.current?.contentWindow?.postMessage({ source: "stageboard", type: "pick", on: inspecting }, "*")}
                />
                {storySurface && !gallery && <AnnotationLayer surface={storySurface} />}
                {storySurface && !gallery && sketching && (
                  <SketchLayer
                    key={current.id}
                    surface={storySurface}
                    components={componentStories}
                    paused={Boolean(draft)}
                    onExit={() => setSketching(false)}
                    onReconcile={(sketch, region) => setDraft({ surface: storySurface, region, viewport: sketch.viewport, scroll: sketch.scroll, sketch })}
                  />
                )}
              </div>
            </div>
            {gallery && storySurface && (
              <Gallery
                storyId={current.id}
                title={storySurface.title}
                used={used[current.id]}
                base={base}
                frameUrl={storySurface.url}
                selectionKey={selectionKey}
              />
            )}
          </div>
        )}
        {route.view === "story" && !current && <div className="sbu-empty">Pick a story on the left.</div>}
        {annotating && !draft && (
          <div className="sbu-annot-hint" role="status">
            Drag over {route.view === "canvas" ? "a page" : gallery ? "any variant" : "the story"} to annotate, or click a spot
            <span className="sbu-key">esc</span>
          </div>
        )}
      </main>
      {draft && <Composer key={draft.surface.key} draft={draft} onClose={() => setDraft(undefined)} onSent={onSent} />}
      {openJob && (
        <PinDetails
          key={openJob.id}
          job={openJob}
          onClose={() => setOpenPin(undefined)}
          onDismiss={dismiss}
          onShowVariants={route.view === "story" ? () => (setGallery(true), setOpenPin(undefined)) : undefined}
        />
      )}
      </AnnotateProvider>
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
