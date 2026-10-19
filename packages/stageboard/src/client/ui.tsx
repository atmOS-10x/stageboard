import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { devtoolsCss, Panel, startBridge, useStageboard } from "stageboard/react"
import { componentFrame, DEVICES, type Device, type ElementTarget, type Flow, type Region } from "stageboard"
import { AnnotateProvider, AnnotationLayer, useDismissedPins, type Draft, type Surface } from "./annotate"
import { fetchUsedVariants, storyUrl } from "./api"
import { ComponentCard, ComponentRows, componentGroup, frameOf, Grid, groupBy, ScreenCard, screenGroup, screenTitle, dragStory, useSurfaces, type Frame, type ScreenNode } from "./browse"
import { Composer } from "./composer"
import { clearDraft, readDraft, readPrefs, savePrefs, type StoredDraft } from "./draft-store"
import { FlowsView } from "./flows"
import { FlowViewer } from "./viewer"
import { VariantLayer } from "./variant-layer"
import { AnnotateIcon, MenuIcon, CopyIcon, ExternalIcon, InspectIcon, LayersIcon, MonitorIcon, MoonIcon, NextIcon, PlusIcon, PrevIcon, SearchIcon, SunIcon } from "./icons"
import { Button, IconButton, Input, Segmented, Tabs } from "./kit"
import { Shimmer } from "./shimmer"
import { clearSketch, SketchLayer } from "./sketch"
import { PinDetails } from "./pins"
import { pushToast, Toasts, useJobToasts } from "./toasts"
import { uiCss } from "./styles"
import { findScreen, hrefPath } from "./routes"
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
  open,
  onNavigate,
  extra,
  tab,
  screens,
  components,
  active,
  onPick,
  onComponent,
  onFlow,
  onNewFlow,
}: {
  open: boolean
  onNavigate: () => void
  extra?: ReactNode
  tab: Tab
  screens: ScreenNode[]
  components: ClientEntry[]
  active?: string
  onPick: (id: string) => void
  onComponent: (group: string, step: number) => void
  onFlow: (id: string) => void
  onNewFlow: () => void
}) {
  const [q, setQ] = useState("")
  const flows = useStageboard((s) => s.flows)
  const match = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase())
  const placeholder = tab === "flows" ? "Search flows" : tab === "components" ? "Search components" : "Search screens"
  return (
    <aside className="sbu-side" data-open={open} onClick={(e) => (e.target as HTMLElement).closest("button.sbu-story") && onNavigate()}>
      {extra}
      <Input className="sbu-side-search" icon={<SearchIcon size={15} />} placeholder={placeholder} aria-label={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {tab === "screens" &&
        groupBy(
          screens.filter((s) => match(`${s.page.title ?? ""} ${s.entry.title} ${s.entry.name} ${s.page.route}`)),
          screenGroup,
        ).map(([group, list]) => (
          <div className="sbu-group" key={group}>
            <div className="sbu-group-title">{group.replaceAll("/", " / ")}</div>
            {list.map((s) => (
              <button key={s.entry.id} className="sbu-story" data-on={active === s.entry.id} onClick={() => onPick(s.entry.id)} draggable onDragStart={dragStory(s.entry.id)} title={s.page.route}>
                {screenTitle(s)}
              </button>
            ))}
          </div>
        ))}
      {tab === "flows" && (
        <>
          <Button size="sm" variant="ghost" icon={<PlusIcon size={14} />} className="sbu-side-action" onClick={onNewFlow}>
            New flow
          </Button>
          {groupBy(
            flows.filter((f) => match(`${f.name} ${f.group ?? ""} ${f.description ?? ""}`)),
            (f) => f.group ?? "Flows",
          ).map(([group, list]) => (
            <div className="sbu-group" key={group}>
              <div className="sbu-group-title">{group.replaceAll("/", " / ")}</div>
              {list.map((f) => (
                <button key={f.id} className="sbu-story" onClick={() => onFlow(f.id)} title={`${f.steps.length} screens`}>
                  {f.name}
                </button>
              ))}
            </div>
          ))}
          {!flows.length && <p className="sbu-dim" style={{ padding: 8 }}>No flows yet.</p>}
          <div className="sbu-group">
            <div className="sbu-group-title" title="Drag a screen into a flow">Screens</div>
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
              <button key={c.id} className="sbu-story" data-on={active === c.id} onClick={() => onComponent(group, components.filter((x) => componentGroup(x) === group).indexOf(c))}>
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
  const [device, setDeviceState] = useState<Device>(() => (localStorage.getItem(DEVICE_KEY) as Device | null) ?? (matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop"))
  const setDevice = (d: Device) => {
    localStorage.setItem(DEVICE_KEY, d)
    setDeviceState(d)
  }
  const [composingFlow, setComposingFlow] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const scheme = useSystemScheme()
  useJobToasts()
  const [theme, setTheme] = useState<"light" | "dark" | undefined>()
  const [inspecting, setInspectingState] = useState(false)
  const [annotating, setAnnotatingState] = useState(false)
  const [draft, setDraft] = useState<Draft>()
  const [restore, setRestore] = useState<StoredDraft | undefined>(readDraft)
  const [openPin, setOpenPin] = useState<string>()
  const [dismissed, dismiss] = useDismissedPins()
  const [showVariants, setShowVariants] = useState(false)
  const [variantCount, setVariantCount] = useState(0)
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
      if (on) setInspectingState(false)
      else setDraft(undefined)
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
  const componentThumb = useCallback(
    (id: string) => {
      const p = new URLSearchParams({ w: "720", h: "450", cs: scheme })
      if (theme) p.set("t", theme)
      return `${base}/api/thumb/${id}.jpg?${p}`
    },
    [base, theme, scheme],
  )
  // A component renders in its own frame; a small one at a higher density, so it stays sharp when its tile enlarges it.
  const tileThumb = useCallback(
    (id: string, frame: Frame) => {
      const x = Math.round(Math.min(2, Math.max(0.5, 960 / frame.width)) * 4) / 4
      const p = new URLSearchParams({ w: String(frame.width), h: String(frame.height), x: String(x), cs: scheme, s: selectionKey.slice(0, 200) })
      if (theme) p.set("t", theme)
      return `${base}/api/thumb/${id}.jpg?${p}`
    },
    [base, selectionKey, theme, scheme],
  )
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

  // A link or router.push in the open screen opens the screen whose route it matches.
  const storyId = route.view === "story" ? route.id : undefined
  const storyFrom = route.view === "story" ? route.from : undefined
  useEffect(() => {
    if (!storyId || !storyFrom) return
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard" || e.data.type !== "navigate" || !e.source || e.source !== storyFrame.current?.contentWindow) return
      const href = String(e.data.href ?? "")
      if (!href || href.startsWith("#")) return
      const here = pages.find((p) => p.entry.id === storyId)
      const path = hrefPath(href, here?.page.route)
      const next = path ? findScreen(pages, path) : undefined
      // Another state of the same route counts as already being there.
      if (!next) pushToast({ tone: "info", title: `No screen for ${path?.split(/[?#]/)[0] ?? href}` })
      else if (next.page.route !== here?.page.route) go({ view: "story", id: next.entry.id, from: storyFrom })
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [storyId, storyFrom, pages, go])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyC") setInspecting((v) => !v)
      if (e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return
      if (["a", "A", "Escape"].includes(e.key)) keyAction(e.key)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [keyAction, setInspecting])

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
    setShowVariants(false)
    setMenuOpen(false)
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
      setAnnotatingState(false)
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
  // Page stories whose parameters never resolved to a route (e.g. a story that unsets the meta's page) would be in
  // neither view, so once the screens have loaded they show up with the components.
  const componentStories = useMemo(() => {
    const screens = new Set(pages.map((p) => p.entry.id))
    return index.filter((s) => !s.hasPage || (!pagesLoading && !screens.has(s.id) && !(s as { dream?: string }).dream))
  }, [index, pages, pagesLoading])
  // The open screen's parameters.page.links, as the screens they lead to.
  const outgoing = useMemo(() => {
    const here = current && pages.find((p) => p.entry.id === current.id)
    const out: { link: string; screen: ScreenNode }[] = []
    for (const link of here?.page.links ?? []) {
      const screen = findScreen(pages, link)
      if (screen && screen.entry.id !== here!.entry.id && !out.some((o) => o.screen.entry.id === screen.entry.id)) out.push({ link, screen })
    }
    return out
  }, [current, pages])
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
  const componentSections = useMemo(() => groupBy(componentStories, componentGroup), [componentStories])
  // A component opens in the flow viewer: its stories are the steps, ← → go through them, notes go to all of them.
  const viewerComponent = useMemo<Flow | undefined>(() => {
    if (route.view !== "components" || route.step === undefined) return undefined
    const list = componentSections.find(([g]) => g === route.focus)?.[1]
    if (!list?.length) return undefined
    return { id: `component:${route.focus}`, name: route.focus!, status: "ready", createdAt: "", steps: list.map((e) => ({ id: e.id, storyId: e.id })) }
  }, [route, componentSections])
  const frameOfStory = useCallback(
    (id: string) => {
      const e = index.find((x) => x.id === id)
      return e ? frameOf(e) : componentFrame()
    },
    [index],
  )
  const currentIsComponent = Boolean(current && componentStories.includes(current))
  const currentFrame = current && currentIsComponent ? frameOf(current) : undefined
  const askMoreVariants = (frame: HTMLIFrameElement | null | undefined, surface: Surface, box: { rect: Region }) => {
    savePrefs({ ...readPrefs(), mode: "variants" })
    setShowVariants(false)
    setAnnotatingState(false)
    const win = frame?.contentWindow
    setDraft({
      surface,
      region: box.rect,
      viewport: { width: win?.innerWidth ?? frameSize.width, height: win?.innerHeight ?? frameSize.height },
      scroll: { x: win?.scrollX ?? 0, y: win?.scrollY ?? 0 },
    })
  }

  return (
    <div className="sbu" data-screens={theme ?? scheme}>
      <header className="sbu-top">
        <IconButton size="sm" variant="ghost" className="sbu-menu-btn" icon={<MenuIcon size={18} />} label="Menu" on={menuOpen} onClick={() => setMenuOpen((v) => !v)} />
        <div className="sbu-brand">
          <Mark /> stageboard
        </div>
        <Tabs label="Browse" tabs={TABS.map((t) => ({ value: t.id, label: t.label }))} value={tab} onChange={(t) => go({ view: t })} />
        <div className="sbu-spacer" />
        {activeJobs > 0 && (
          <span className="sbu-working">
            <Shimmer>{`${activeJobs} agent${activeJobs === 1 ? "" : "s"} working`}</Shimmer>
          </span>
        )}
        {tab !== "components" && (
          <Segmented
            className="sbu-hide-phone"
            label="Device"
            size="sm"
            value={device}
            onChange={setDevice}
            options={(Object.keys(DEVICES) as Device[]).map((d) => ({ value: d, label: DEVICES[d].label, title: `${DEVICES[d].width}×${DEVICES[d].height}` }))}
          />
        )}
        {tab !== "flows" && (
          <Button size="sm" icon={<AnnotateIcon size={14} />} on={annotating} onClick={() => setAnnotating((v) => !v)} title="Comment on any part of a screen; on a single screen, also move, retype and draw · A">
            Annotate
          </Button>
        )}
        <ThemeButton className="sbu-hide-phone" theme={theme} onTheme={setTheme} />
        {!connected && <span className="sbu-offline" title="The stageboard bridge is offline: start it with stageboard dev" />}
      </header>
      {menuOpen && <div className="sbu-scrim" onClick={() => setMenuOpen(false)} />}
      <Sidebar
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
        extra={
          <div className="sbu-side-phone">
            <Segmented
              label="Device"
              size="sm"
              value={device}
              onChange={setDevice}
              options={(Object.keys(DEVICES) as Device[]).map((d) => ({ value: d, label: DEVICES[d].label }))}
            />
            <ThemeButton theme={theme} onTheme={setTheme} />
          </div>
        }
        tab={tab}
        screens={pages}
        components={componentStories}
        active={current?.id}
        onPick={openStory}
        onComponent={(group, step) => go({ view: "components", focus: group, step })}
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
                return <ScreenCard key={e.id} entry={e} title={screenTitle(s)} device={device} thumbUrl={thumbUrl} surface={screenSurfaces.get(e.id)!} onOpen={() => openStory(e.id)} />
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
            ctx={{ device, screens: pages, index, thumbUrl, frameUrl, base, onOpen: openStory, onStep: (flowId, step) => go({ view: "flows", focus: flowId, step }) }}
            focus={route.focus}
            composing={composingFlow}
            onCompose={setComposingFlow}
          />
        )}
        {viewerFlow && route.view === "flows" && route.step !== undefined && (
          <FlowViewer
            key={viewerFlow.id}
            flow={viewerFlow}
            base={base}
            step={Math.min(route.step, Math.max(0, viewerFlow.steps.length - 1))}
            device={device}
            screens={pages}
            index={index}
            components={componentStories}
            componentThumb={componentThumb}
            themeButton={<ThemeButton size="md" theme={theme} onTheme={setTheme} />}
            frameUrl={frameUrl}
            thumbUrl={thumbUrl}
            annotating={annotating}
            onAnnotate={(on) => setAnnotating(on)}
            draftOpen={Boolean(draft)}
            onDraft={setDraft}
            onStep={(step) => go({ view: "flows", focus: viewerFlow.id, step })}
            onFlow={(flowId, step) => go({ view: "flows", focus: flowId, step })}
            onOpenScreen={(id) => go({ view: "story", id, from: "flows" })}
            onClose={() => go({ view: "flows", focus: viewerFlow.id })}
          />
        )}
        {route.view === "components" && (
          <ComponentRows
            sections={componentSections}
            focus={route.focus}
            onOpenGroup={(group) => go({ view: "components", focus: group, step: 0 })}
            render={(e, group, i) => (
              <ComponentCard key={e.id} entry={e} thumbUrl={tileThumb} surface={componentSurfaces.get(e.id)!} onOpen={() => go({ view: "components", focus: group, step: i })} />
            )}
          />
        )}
        {viewerComponent && route.view === "components" && route.step !== undefined && (
          <FlowViewer
            key={viewerComponent.id}
            flow={viewerComponent}
            frameOf={frameOfStory}
            base={base}
            step={Math.min(route.step, viewerComponent.steps.length - 1)}
            device={device}
            screens={pages}
            index={index}
            components={componentStories}
            componentThumb={componentThumb}
            themeButton={<ThemeButton size="md" theme={theme} onTheme={setTheme} />}
            frameUrl={frameUrl}
            thumbUrl={thumbUrl}
            annotating={annotating}
            onAnnotate={(on) => setAnnotating(on)}
            draftOpen={Boolean(draft)}
            onDraft={setDraft}
            onStep={(step) => go({ view: "components", focus: viewerComponent.name, step })}
            onFlow={(flowId, step) => go({ view: "flows", focus: flowId, step })}
            onOpenScreen={(id) => go({ view: "story", id, from: "components" })}
            onClose={() => go({ view: "components", focus: viewerComponent.name })}
          />
        )}
        {route.view === "story" && current && (
          <div className="sbu-story-view">
            <div className="sbu-toolbar">
              <Button size="sm" variant="ghost" icon={<PrevIcon size={14} />} onClick={() => go({ view: route.from })}>
                {TABS.find((t) => t.id === route.from)?.label}
              </Button>
              <span className="sbu-title" title={`${current.title} / ${current.name}`}>
                {pages.find((p) => p.entry.id === current.id)?.page.title ?? current.name}
              </span>
              {outgoing.length > 0 && (
                <nav className="sbu-links sbu-hide-phone" aria-label="Links from this screen">
                  {outgoing.map(({ link, screen }) => (
                    <Button key={screen.entry.id} size="sm" variant="ghost" icon={<NextIcon size={12} />} title={`Open ${link}`} onClick={() => openStory(screen.entry.id)}>
                      {screenTitle(screen)}
                    </Button>
                  ))}
                </nav>
              )}
              <span className="sbu-spacer" />
              <IconButton size="sm" icon={<InspectIcon size={14} />} label="Inspect an element · Alt+Shift+C" on={inspecting} onClick={() => setInspecting((v) => !v)} />
              <Button
                size="sm"
                icon={<LayersIcon size={14} />}
                on={showVariants}
                count={variantCount}
                disabled={!variantCount && !showVariants}
                onClick={() => setShowVariants((v) => !v)}
                title={variantCount ? "Outline the parts of this screen that have variants, then click one to switch" : "No variants on this screen yet: annotate a part and ask for Variants"}
              >
                Variants
              </Button>
              <IconButton size="sm" variant="ghost" icon={<ExternalIcon size={14} />} label="Open in a new tab" onClick={() => window.open(frameUrl(current.id).replace("sb-embed=1&", ""), "_blank")} />
              <IconButton
                size="sm"
                variant="ghost"
                icon={<CopyIcon size={14} />}
                label="Copy the screenshot command"
                onClick={() => {
                  const size = currentFrame ?? frameSize
                  void navigator.clipboard?.writeText(`npx stageboard shot ${current.id} --width ${size.width} --height ${size.height}`)
                  pushToast({ tone: "info", title: "Copied the screenshot command" })
                }}
              />
            </div>
            <div className="sbu-stage">
              <div
                className="sbu-frame-wrap"
                data-device={currentFrame ? "component" : device}
                style={
                  currentFrame
                    ? { width: currentFrame.width, height: currentFrame.height, flex: "none" }
                    : device === "desktop"
                      ? { width: "100%" }
                      : { width: frameSize.width, height: Math.min(frameSize.height, 2000), flex: "none" }
                }
              >
                <iframe
                  key={`${current.id}-${theme}`}
                  ref={storyFrame}
                  className="sbu-frame"
                  src={frameUrl(current.id)}
                  title={current.id}
                  onLoad={() => storyFrame.current?.contentWindow?.postMessage({ source: "stageboard", type: "pick", on: inspecting }, "*")}
                />
                {storySurface && <AnnotationLayer surface={storySurface} />}
                {storySurface && (
                  <VariantLayer
                    key={`v-${current.id}`}
                    surface={storySurface}
                    visible={showVariants && !annotating}
                    onCount={setVariantCount}
                    onAskMore={(box) => askMoreVariants(storyFrame.current, storySurface, box)}
                  />
                )}
                {storySurface && annotating && (
                  <SketchLayer
                    key={current.id}
                    surface={storySurface}
                    components={componentStories}
                    componentThumb={componentThumb}
                    paused={Boolean(draft)}
                    onExit={() => setAnnotating(false)}
                    onReconcile={(sketch, region) => setDraft({ surface: storySurface, region, viewport: sketch.viewport, scroll: sketch.scroll, sketch })}
                  />
                )}
              </div>
            </div>
          </div>
        )}
        {route.view === "story" && !current && <div className="sbu-empty">Pick a story on the left.</div>}
        {annotating && !draft && !viewerFlow && !viewerComponent && route.view !== "story" && (
          <div className="sbu-annot-hint" role="status">
            Drag over any part of a screen
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
          onShowVariants={route.view === "story" ? () => (setShowVariants(true), setOpenPin(undefined)) : undefined}
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

type Theme = "light" | "dark" | undefined

// Which theme the screens render in: the system's, or forced dark or light.
function ThemeButton({ theme, onTheme, size = "sm", className }: { theme: Theme; onTheme: (next: (t: Theme) => Theme) => void; size?: "sm" | "md"; className?: string }) {
  const s = size === "md" ? 17 : 14
  return (
    <IconButton
      size={size}
      variant="ghost"
      className={className}
      icon={theme === "dark" ? <MoonIcon size={s} /> : theme === "light" ? <SunIcon size={s} /> : <MonitorIcon size={s} />}
      label={`Screens in ${theme ?? "system"} theme`}
      onClick={() => onTheme((t) => (t === "dark" ? "light" : t === "light" ? undefined : "dark"))}
    />
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
