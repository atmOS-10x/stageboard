import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { devtoolsCss, Panel, startBridge, useStageboard } from "stageboard/react"
import { DEVICES, type Device, type ElementTarget } from "stageboard"
import { AnnotateProvider, AnnotationLayer, useDismissedPins, type Draft, type Surface } from "./annotate"
import { fetchUsedVariants, storyUrl } from "./api"
import { componentGroup, Grid, groupBy, ScreenCard, screenGroup, screenTitle, dragStory, useSurfaces, type ScreenNode } from "./browse"
import { Composer } from "./composer"
import { clearDraft, readDraft, type StoredDraft } from "./draft-store"
import { FlowsView } from "./flows"
import { FlowViewer } from "./viewer"
import { Gallery } from "./gallery"
import { AnnotateIcon, InspectIcon, LayersIcon, PlusIcon, SketchIcon } from "./icons"
import { clearSketch, SketchLayer } from "./sketch"
import { PinDetails } from "./pins"
import { Toasts, useJobToasts } from "./toasts"
import { uiCss } from "./styles"
import { resolveStory, type ClientEntry, type Loaders, type StoryModule } from "./types"
import { WaveCanvas } from "./waves"

type UIOptions = { index: ClientEntry[]; loaders: Loaders; base: string }

type Tab = "screens" | "flows" | "components"
type Route = { view: Tab; focus?: string; step?: number } | { view: "story"; id: string; from: Tab }

const TABS: { id: Tab; label: string }[] = [
  { id: "screens", label: "Screens" },
  { id: "flows", label: "Flows" },
  { id: "components", label: "Components" },
]
const DEVICE_KEY = "stageboard:device"

function parseHash(): Route {
  const story = /^#\/story\/([^?]+)(?:\?from=(\w+))?$/.exec(location.hash)
  if (story) return { view: "story", id: decodeURIComponent(story[1]), from: (TABS.find((t) => t.id === story[2])?.id ?? "screens") as Tab }
  const tab = /^#\/(screens|flows|components)(?:\/([^/]+))?(?:\/(\d+))?$/.exec(location.hash)
  if (tab) return { view: tab[1] as Tab, focus: tab[2] ? decodeURIComponent(tab[2]) : undefined, step: tab[3] ? Number(tab[3]) : undefined }
  return { view: "screens" }
}

function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash)
  useEffect(() => {
    const on = () => setRoute(parseHash())
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  const go = useCallback((r: Route) => {
    location.hash =
      r.view === "story"
        ? `#/story/${encodeURIComponent(r.id)}?from=${r.from}`
        : `#/${r.view}${r.focus ? `/${encodeURIComponent(r.focus)}` : ""}${r.focus && r.step !== undefined ? `/${r.step}` : ""}`
  }, [])
  return [route, go]
}

function useSystemScheme(): "light" | "dark" {
  const query = "(prefers-color-scheme: dark)"
  const [dark, setDark] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setDark(m.matches)
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return dark ? "dark" : "light"
}

function usePages(index: ClientEntry[], loaders: Loaders): { pages: ScreenNode[]; loading: boolean } {
  const [pages, setPages] = useState<ScreenNode[]>([])
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
      const out: ScreenNode[] = []
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

function LoadingGrid({ entries, device }: { entries: ClientEntry[]; device: Device }) {
  const d = DEVICES[device]
  return (
    <div className="sbu-browse" data-device={device} role="status" aria-label={`Loading ${entries.length} screens`}>
      <section className="sbu-browse-section">
        <h2 className="sbu-browse-title">
          Loading {entries.length} screen{entries.length === 1 ? "" : "s"}…
        </h2>
        <div className="sbu-grid">
          {entries.slice(0, 12).map((e) => (
            <div key={e.id} className="sbu-card-screen">
              <div className="sbu-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }}>
                <WaveCanvas mode="render" fps={30} />
              </div>
              <div className="sbu-card-caption">
                <span className="sbu-card-title">{e.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
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

function Sidebar({
  tab,
  screens,
  components,
  active,
  onPick,
  onFlow,
  onNewFlow,
}: {
  tab: Tab
  screens: ScreenNode[]
  components: ClientEntry[]
  active?: string
  onPick: (id: string) => void
  onFlow: (id: string) => void
  onNewFlow: () => void
}) {
  const [q, setQ] = useState("")
  const flows = useStageboard((s) => s.flows)
  const match = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase())
  const placeholder = tab === "flows" ? "Search flows" : tab === "components" ? "Search components" : "Search screens"
  return (
    <aside className="sbu-side">
      <input className="sbu-search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {tab === "screens" &&
        groupBy(
          screens.filter((s) => match(`${s.page.title ?? ""} ${s.entry.title} ${s.entry.name} ${s.page.route}`)),
          screenGroup,
        ).map(([group, list]) => (
          <div className="sbu-group" key={group}>
            <div className="sbu-group-title">{group.replaceAll("/", " / ")}</div>
            {list.map((s) => (
              <button key={s.entry.id} className="sbu-story" data-on={active === s.entry.id} onClick={() => onPick(s.entry.id)} draggable onDragStart={dragStory(s.entry.id)}>
                {screenTitle(s)}
                <span className="sbu-badge">{s.page.route}</span>
              </button>
            ))}
          </div>
        ))}
      {tab === "flows" && (
        <>
          <button className="sbu-story sbu-side-action" onClick={onNewFlow}>
            <PlusIcon size={12} /> New flow
          </button>
          {groupBy(
            flows.filter((f) => match(`${f.name} ${f.group ?? ""} ${f.description ?? ""}`)),
            (f) => f.group ?? "Flows",
          ).map(([group, list]) => (
            <div className="sbu-group" key={group}>
              <div className="sbu-group-title">{group.replaceAll("/", " / ")}</div>
              {list.map((f) => (
                <button key={f.id} className="sbu-story" onClick={() => onFlow(f.id)}>
                  {f.name}
                  <span className="sbu-badge">{f.steps.length}</span>
                </button>
              ))}
            </div>
          ))}
          {!flows.length && <p className="sbu-dim" style={{ padding: 8 }}>No flows yet.</p>}
          <div className="sbu-group">
            <div className="sbu-group-title">Screens · drag into a flow</div>
            {screens
              .filter((s) => match(`${s.page.title ?? ""} ${s.entry.name} ${s.page.route}`))
              .map((s) => (
                <button key={s.entry.id} className="sbu-story" onClick={() => onPick(s.entry.id)} draggable onDragStart={dragStory(s.entry.id)}>
                  {screenTitle(s)}
                </button>
              ))}
          </div>
        </>
      )}
      {tab === "components" &&
        groupBy(components.filter((c) => match(`${c.title} ${c.name}`)), componentGroup).map(([group, list]) => (
          <div className="sbu-group" key={group}>
            <div className="sbu-group-title">{group.replaceAll("/", " / ")}</div>
            {list.map((c) => (
              <button key={c.id} className="sbu-story" data-on={active === c.id} onClick={() => onPick(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        ))}
    </aside>
  )
}

function App({ index, loaders, base }: UIOptions) {
  const [route, go] = useRoute()
  const [device, setDeviceState] = useState<Device>(() => (localStorage.getItem(DEVICE_KEY) as Device | null) ?? "desktop")
  const setDevice = (d: Device) => {
    localStorage.setItem(DEVICE_KEY, d)
    setDeviceState(d)
  }
  const [composingFlow, setComposingFlow] = useState(false)
  const scheme = useSystemScheme()
  useJobToasts()
  const [theme, setTheme] = useState<"light" | "dark" | undefined>()
  const [inspecting, setInspectingState] = useState(false)
  const [annotating, setAnnotatingState] = useState(false)
  const [sketching, setSketching] = useState(false)
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
      if ((key === "s" || key === "S") && parseHash().view === "story") {
        setAnnotatingState(false)
        setSketching((v) => !v)
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
    (id: string) => {
      const d = DEVICES[device]
      const p = new URLSearchParams({ w: String(d.width), h: String(d.height), cs: scheme, s: selectionKey.slice(0, 200) })
      if (theme) p.set("t", theme)
      return `${base}/api/thumb/${id}.jpg?${p}`
    },
    [base, selectionKey, device, theme, scheme],
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
      if (["a", "A", "s", "S"].includes(e.key) || (e.key === "Escape" && !sketching)) keyAction(e.key)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keyAction, setInspecting, sketching])

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
      window.dispatchEvent(new Event("stageboard:sketch-sent"))
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
  const tab: Tab = route.view === "story" ? route.from : route.view
  const openStory = useCallback((id: string) => go({ view: "story", id, from: tab }), [go, tab])
  const storyUrlOf = useCallback((id: string) => storyUrl(frameUrl(id)), [frameUrl])
  const screenSurfaces = useSurfaces(
    pages.map((p) => p.entry),
    "screen",
    (e) => e.name,
    storyUrlOf,
  )
  const componentSurfaces = useSurfaces(componentStories, "component", (e) => `${e.title} / ${e.name}`, storyUrlOf)
  const frameSize = DEVICES[device]
  const flows = useStageboard((s) => s.flows)
  const viewerFlow = route.view === "flows" && route.step !== undefined ? flows.find((f) => f.id === route.focus) : undefined
  const galleryRows = current
    ? (used[current.id] ?? []).filter((id) => variantFiles.some((v) => v.of === id)).length
    : 0

  return (
    <div className="sbu">
      <header className="sbu-top">
        <div className="sbu-brand">
          <Mark /> stageboard
        </div>
        <nav className="sbu-nav" aria-label="Browse">
          {TABS.map((t) => (
            <button key={t.id} data-on={tab === t.id} onClick={() => go({ view: t.id })}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sbu-tabs sbu-devices" role="radiogroup" aria-label="Device">
          {(Object.keys(DEVICES) as Device[]).map((d) => (
            <button key={d} role="radio" aria-checked={device === d} data-on={device === d} onClick={() => setDevice(d)} title={`${DEVICES[d].width}×${DEVICES[d].height}`}>
              {DEVICES[d].label}
            </button>
          ))}
        </div>
        <div className="sbu-spacer" />
        {activeJobs > 0 && <span className="sbu-dim">{activeJobs} agent{activeJobs === 1 ? "" : "s"} working…</span>}
        {route.view === "story" && (
          <button className="sbu-btn" data-on={inspecting} onClick={() => setInspecting((v) => !v)} title="Inspect an element · Alt+Shift+C">
            <InspectIcon size={13} />
            Inspect
          </button>
        )}
        <button className="sbu-btn" data-on={annotating} aria-pressed={annotating} onClick={() => setAnnotating((v) => !v)} title="Drag over a screen to annotate · A">
          <AnnotateIcon size={13} />
          Annotate
          <span className="sbu-key">A</span>
        </button>
        <button className="sbu-btn" onClick={() => setTheme((t) => (t === "dark" ? "light" : t === "light" ? undefined : "dark"))}>
          Theme: {theme ?? "system"}
        </button>
        {!connected && <span className="sbu-dim" title="Start it with stageboard dev">Bridge offline</span>}
      </header>
      <Sidebar
        tab={tab}
        screens={pages}
        components={componentStories}
        active={current?.id}
        onPick={openStory}
        onFlow={(id) => go({ view: "flows", focus: id })}
        onNewFlow={() => {
          setComposingFlow(true)
          go({ view: "flows" })
        }}
      />
      <AnnotateProvider base={base} active={annotating} draft={draft} restore={restore} onBegin={begin} openPin={openPin} onTogglePin={setOpenPin} dismissed={dismissed}>
      <main className="sbu-main" data-annotating={annotating}>
        {route.view === "screens" &&
          (pagesLoading && !pages.length ? (
            <LoadingGrid entries={index.filter((s) => s.hasPage)} device={device} />
          ) : pages.length ? (
            <Grid
              device={device}
              sections={groupBy(pages, screenGroup).map(([g, list]) => [g, list.map((p) => p.entry)])}
              render={(e) => {
                const s = pages.find((p) => p.entry.id === e.id)
                return <ScreenCard key={e.id} entry={e} title={screenTitle(s)} subtitle={s?.page.route} device={device} thumbUrl={thumbUrl} surface={screenSurfaces.get(e.id)!} onOpen={() => openStory(e.id)} />
              }}
            />
          ) : (
            <div className="sbu-empty">
              <div>
                <p style={{ fontSize: 15, color: "#ededf0" }}>No screens yet</p>
                <p>
                  Add <span className="sbu-mono">parameters: {"{ page: { route: \"/\" } }"}</span> to a story to list it as a screen.
                </p>
              </div>
            </div>
          ))}
        {route.view === "flows" && (
          <FlowsView
            ctx={{ device, screens: pages, index, thumbUrl, frameUrl, onOpen: openStory, onStep: (flowId, step) => go({ view: "flows", focus: flowId, step }) }}
            focus={route.focus}
            composing={composingFlow}
            onCompose={setComposingFlow}
          />
        )}
        {viewerFlow && route.view === "flows" && route.step !== undefined && (
          <FlowViewer
            key={viewerFlow.id}
            flow={viewerFlow}
            step={Math.min(route.step, Math.max(0, viewerFlow.steps.length - 1))}
            device={device}
            screens={pages}
            index={index}
            components={componentStories}
            frameUrl={frameUrl}
            thumbUrl={thumbUrl}
            annotating={annotating}
            onAnnotate={(on) => setAnnotating(on)}
            draftOpen={Boolean(draft)}
            onDraft={(next) => {
              setAnnotatingState(false)
              setDraft(next)
            }}
            onStep={(step) => go({ view: "flows", focus: viewerFlow.id, step })}
            onFlow={(flowId, step) => go({ view: "flows", focus: flowId, step })}
            onOpenScreen={(id) => go({ view: "story", id, from: "flows" })}
            onClose={() => go({ view: "flows", focus: viewerFlow.id })}
          />
        )}
        {route.view === "components" && (
          <Grid
            device={device}
            sections={groupBy(componentStories, componentGroup)}
            render={(e) => <ScreenCard key={e.id} entry={e} title={e.name} device={device} thumbUrl={thumbUrl} surface={componentSurfaces.get(e.id)!} onOpen={() => openStory(e.id)} />}
          />
        )}
        {route.view === "story" && current && (
          <div className="sbu-story-view">
            <div className="sbu-toolbar">
              <button className="sbu-btn" onClick={() => go({ view: route.from })}>
                ← {TABS.find((t) => t.id === route.from)?.label}
              </button>
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
              <button className="sbu-btn" onClick={() => window.open(frameUrl(current.id).replace("sb-embed=1&", ""), "_blank")}>
                Open
              </button>
              <button
                className="sbu-btn"
                title="Copy screenshot command"
                onClick={() => navigator.clipboard?.writeText(`npx stageboard shot ${current.id} --width ${frameSize.width} --height ${frameSize.height}`)}
              >
                Copy shot cmd
              </button>
            </div>
            <div className="sbu-stage" data-hidden={gallery}>
              <div className="sbu-frame-wrap" data-device={device} style={device === "desktop" ? { width: "100%" } : { width: frameSize.width, height: Math.min(frameSize.height, 2000), flex: "none" }}>
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
                viewport={{ width: frameSize.width, height: frameSize.height }}
              />
            )}
          </div>
        )}
        {route.view === "story" && !current && <div className="sbu-empty">Pick a story on the left.</div>}
        {annotating && !draft && (
          <div className="sbu-annot-hint" role="status">
            Drag over {route.view === "story" ? (gallery ? "any variant" : "the screen") : "any screen"} to annotate, or click a spot
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
      <Toasts />
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
