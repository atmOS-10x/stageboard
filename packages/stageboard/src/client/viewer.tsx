import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type WheelEvent as RWheelEvent } from "react"
import { updateFlow, useStageboard } from "stageboard/react"
import { DEVICES, formatAction, parseActions, type Device, type Flow, type FlowStep } from "stageboard"
import { AnnotationLayer, type Draft, type Surface } from "./annotate"
import { storyUrl } from "./api"
import { screenTitle, type ScreenNode } from "./browse"
import { DESCRIBE_STEPS, FlowNote, sendFlowNote, type FlowBatch } from "./flows"
import { AnnotateIcon, CloseIcon, EditIcon, ExternalIcon, FlowNoteIcon, InfoIcon, LayersIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, ResetIcon } from "./icons"
import type { PlayResult } from "./frame"
import { Shimmer } from "./shimmer"
import { WaveCanvas } from "./waves"
import { readPrefs, savePrefs } from "./draft-store"
import { Button, IconButton, Input } from "./kit"
import { errorText, pushToast } from "./toasts"
import { clearSketch, SketchLayer } from "./sketch"
import { clearComments, readComments, removeComment, sketchedSteps, toAnnotations, useBatchVersion } from "./flow-batch"
import { VariantLayer } from "./variant-layer"
import { findScreen, hrefPath } from "./routes"
import type { ClientEntry } from "./types"

const SWIPE = 70
const GAP = 32
const PRELOAD = 2

export function FlowViewer({
  flow,
  step,
  device,
  base,
  screens,
  index,
  components,
  componentThumb,
  themeButton,
  frameUrl,
  thumbUrl,
  annotating,
  onAnnotate,
  draftOpen,
  onDraft,
  onStep,
  onFlow,
  onOpenScreen,
  onClose,
}: {
  flow: Flow
  step: number
  device: Device
  base: string
  screens: ScreenNode[]
  index: ClientEntry[]
  components: ClientEntry[]
  componentThumb: (id: string) => string
  themeButton: ReactNode
  frameUrl: (id: string) => string
  thumbUrl: (id: string) => string
  annotating: boolean
  onAnnotate: (on: boolean) => void
  draftOpen: boolean
  onDraft: (draft: Draft) => void
  onStep: (index: number) => void
  onFlow: (flowId: string, index: number) => void
  onOpenScreen: (storyId: string) => void
  onClose: () => void
}) {
  const flows = useStageboard((s) => s.flows)
  const dreams = useStageboard((s) => s.dreams)
  const d = DEVICES[device]
  const stage = useRef<HTMLDivElement>(null)
  const frames = useRef(new Map<string, HTMLIFrameElement>())
  const [ready, setReady] = useState<Set<string>>(() => new Set())
  const [tools, setTools] = useState<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [info, setInfo] = useState(false)
  // The current screen only takes clicks and keys once it is made live (click it or press Enter), so swiping,
  // arrow keys and pages that listen to the keyboard don't fight the viewer.
  const [live, setLive] = useState(false)
  const [noting, setNoting] = useState(false)
  const [variantsOn, setVariantsOn] = useState(false)
  const [variantCount, setVariantCount] = useState(0)

  const storyOf = useCallback(
    (i: number) => {
      const s = flow.steps[i]
      if (!s) return undefined
      return s.storyId ?? (s.dream ? screens.find((x) => x.page.dream === s.dream)?.entry.id ?? dreams.find((x) => x.id === s.dream)?.storyId : undefined)
    },
    [flow.steps, screens, dreams],
  )
  const storyId = storyOf(step)
  const entry = storyId ? index.find((e) => e.id === storyId) : undefined
  const screen = storyId ? screens.find((s) => s.entry.id === storyId) : undefined
  const count = flow.steps.length
  const currentStep = flow.steps[step]
  const frameOfCurrent = useCallback(() => (currentStep ? frames.current.get(currentStep.id) : undefined), [currentStep])
  const [editingStep, setEditingStep] = useState(false)
  const busy = annotating || draftOpen || noting || live || editingStep
  // Annotating goes on across screens: the arrow keys still move between them, so notes collect along the flow.
  const navBusy = draftOpen || noting || live || editingStep

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = box.width ? Math.min(1, (box.width * (box.width < 760 ? 0.9 : 0.72)) / d.width, (box.height - 8) / d.height) : 0
  const w = d.width * scale
  const h = d.height * scale

  const go = useCallback((delta: number) => onStep(Math.max(0, Math.min(count - 1, step + delta))), [onStep, count, step])

  useEffect(() => {
    setLive(false)
    setEditingStep(false)
    setInfo(false)
    setVariantsOn(false)
    setVariantCount(0)
  }, [step, flow.id])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard" || e.data.type !== "ready") return
      for (const [id, el] of frames.current) {
        if (el.contentWindow !== e.source) continue
        setReady((r) => (r.has(id) ? r : new Set(r).add(id)))
        // A screen that autofocuses a field would scroll the viewer and swallow the arrow keys.
        try {
          ;(el.contentDocument?.activeElement as HTMLElement | null)?.blur()
        } catch {}
        stage.current?.scrollTo(0, 0)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  useEffect(() => {
    setReady(new Set())
    played.current.clear()
  }, [device, frameUrl])

  useEffect(() => {
    if (annotating || draftOpen || noting) setLive(false)
  }, [annotating, draftOpen, noting])

  useEffect(() => {
    const el = frameOfCurrent()
    el?.contentWindow?.postMessage({ source: "stageboard", type: "live", on: live }, "*")
    if (!live) return
    el?.focus()
    el?.contentWindow?.focus()
    // Clicking anywhere outside the page brings focus back here, and with it the viewer's keys.
    const onFocus = () => setLive(false)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener("focus", onFocus)
      el?.contentWindow?.postMessage({ source: "stageboard", type: "live", on: false }, "*")
    }
  }, [live, frameOfCurrent])

  // Play what the user does on the current screen once it has loaded, with a cursor in the page. A screen that
  // has already played (or been clicked around) loads fresh before it plays again.
  const currentReady = currentStep ? ready.has(currentStep.id) : false
  const [play, setPlay] = useState<{ id: string; stepId: string; index: number; results?: PlayResult[] }>()
  const [touring, setTouring] = useState(false)
  const played = useRef(new Set<string>())
  useEffect(() => {
    if (!currentReady || !currentStep?.actions?.length) return
    if (played.current.has(currentStep.id)) return reset()
    played.current.add(currentStep.id)
    const id = Math.random().toString(36).slice(2)
    setPlay({ id, stepId: currentStep.id, index: -1 })
    frameOfCurrent()?.contentWindow?.postMessage({ source: "stageboard", type: "play", id, actions: currentStep.actions }, "*")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentReady, currentStep?.id])
  useEffect(() => {
    if (!live && !annotating) return
    frameOfCurrent()?.contentWindow?.postMessage({ source: "stageboard", type: "play-stop" }, "*")
    setPlay((p) => (p && !p.results ? { ...p, results: [] } : p))
  }, [live, annotating, frameOfCurrent])
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard" || e.source !== frameOfCurrent()?.contentWindow) return
      if (e.data.type === "play-step") setPlay((p) => (p && p.id === e.data.id ? { ...p, index: Number(e.data.index) } : p))
      if (e.data.type === "play-done") setPlay((p) => (p && p.id === e.data.id ? { ...p, results: e.data.results as PlayResult[] } : p))
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [frameOfCurrent])
  // A link or router.push in the live screen moves along the flow: to the next step when it shows the screen the
  // link goes to, else to the nearest step that does. Played actions and Play flow move on by themselves.
  const playing = Boolean(play && play.stepId === currentStep?.id && !play.results)
  useEffect(() => {
    if (touring || playing) return
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard" || e.data.type !== "navigate" || !e.source || e.source !== frameOfCurrent()?.contentWindow) return
      const href = String(e.data.href ?? "")
      if (!href || href.startsWith("#")) return
      const route = (i: number) => screens.find((s) => s.entry.id === storyOf(i))?.page.route
      const path = hrefPath(href, route(step))
      const target = path ? findScreen(screens, path) : undefined
      if (!target) return pushToast({ tone: "info", title: `No screen for ${path?.split(/[?#]/)[0] ?? href}` })
      if (target.page.route === route(step)) return
      const steps = flow.steps.map((_, i) => i).filter((i) => route(i) === target.page.route)
      const to = steps.includes(step + 1) ? step + 1 : steps.sort((a, b) => Math.abs(a - step) - Math.abs(b - step))[0]
      if (to !== undefined) return onStep(to)
      pushToast({
        tone: "info",
        title: `${screenTitle(target)} isn’t a step of this flow`,
        actions: [{ label: "Open screen", run: () => onOpenScreen(target.entry.id) }],
      })
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [touring, playing, frameOfCurrent, screens, storyOf, step, flow.steps, onStep, onOpenScreen])
  // Play flow: every screen plays its actions, then the viewer moves on to the next one.
  const stepDone = currentReady && (!currentStep?.actions?.length || (play?.stepId === currentStep.id && Boolean(play.results)))
  useEffect(() => {
    if (!touring || !stepDone) return
    if (step >= count - 1) {
      const t = setTimeout(() => setTouring(false), 1200)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => go(1), currentStep?.actions?.length ? 1200 : 2200)
    return () => clearTimeout(t)
  }, [touring, stepDone, step, count, go, currentStep])
  useEffect(() => {
    if (live || annotating || noting) setTouring(false)
  }, [live, annotating, noting])

  function reset() {
    const el = frameOfCurrent()
    if (!el || !currentStep) return
    played.current.delete(currentStep.id)
    setLive(false)
    setReady((r) => {
      const next = new Set(r)
      next.delete(currentStep.id)
      return next
    })
    try {
      el.contentWindow?.location.reload()
    } catch {
      el.src = el.src
    }
  }

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard" || e.data.type !== "key") return
      if (live) {
        if (e.data.key === "Escape") {
          setLive(false)
          window.focus()
        }
        return
      }
      if (navBusy) return
      if (e.data.key === "ArrowRight") go(1)
      if (e.data.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return
      if (navBusy || (busy && e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return
      if (e.key === "ArrowRight") go(1)
      else if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "Escape") onClose()
      else if (e.key === "r" || e.key === "R") reset()
      else if (e.key === "Enter" && !/^(BUTTON|A)$/.test(t.tagName)) setLive(true)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  })

  // Trackpad swipe: horizontal wheel travel past a threshold moves one screen.
  const wheel = useRef({ dx: 0, at: 0 })
  const onWheel = (e: RWheelEvent) => {
    if (busy || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
    const now = Date.now()
    if (now - wheel.current.at > 400) wheel.current.dx = 0
    wheel.current.at = now
    wheel.current.dx += e.deltaX
    if (Math.abs(wheel.current.dx) > SWIPE * 2) {
      go(wheel.current.dx > 0 ? 1 : -1)
      wheel.current = { dx: 0, at: now + 400 }
    }
  }
  const touch = useRef<number | undefined>(undefined)

  const surface = useMemo<Surface | undefined>(
    () =>
      entry && {
        key: `viewer:${entry.id}`,
        storyId: entry.id,
        title: screenTitle(screen, entry),
        url: storyUrl(frameUrl(entry.id)),
        frame: frameOfCurrent,
        scrollsFrame: true,
        batch: flow.id,
        step,
      },
    [entry, screen, frameUrl, frameOfCurrent, flow.id, step],
  )
  // Variants asked for from the outlines are their own request, not part of the flow's batch.
  const plainSurface = useMemo(() => surface && { ...surface, batch: undefined, step: undefined }, [surface])

  // The flow's batch: comments on its screens and the screens sketched on. Reconcile sends them together.
  const batchVersion = useBatchVersion()
  const [sentAt, setSentAt] = useState(0)
  const titleOf = useCallback(
    (id: string) => {
      const e = index.find((x) => x.id === id)
      return e ? screenTitle(screens.find((x) => x.entry.id === id), e) : id
    },
    [index, screens],
  )
  const comments = useMemo(() => readComments(flow.id), [flow.id, batchVersion])
  const sketches = useMemo(() => sketchedSteps(flow, storyOf), [flow, storyOf, batchVersion])
  const batchCount = comments.length + sketches.length
  const batch: FlowBatch = {
    comments,
    sketches,
    titleOf,
    annotations: () => toAnnotations(comments, sketches, titleOf, { width: d.width, height: d.height }),
    onRemoveComment: (id) => removeComment(flow.id, id),
    onRemoveSketch: (id) => {
      clearSketch(id)
      setSentAt(Date.now())
    },
    onSent: () => {
      clearComments(flow.id)
      for (const k of sketches) clearSketch(k.storyId)
      setSentAt(Date.now())
      onAnnotate(false)
    },
  }
  const marks = useMemo(
    () => comments.map((c, i) => ({ id: c.id, n: i + 1, region: c.region, viewport: c.viewport, note: c.note, storyId: c.storyId })).filter((m) => m.storyId === storyId),
    [comments, storyId],
  )
  const also = flows
    .filter((f) => f.id !== flow.id)
    .flatMap((f) => {
      const i = f.steps.findIndex((s) => s.storyId === storyId)
      return i >= 0 ? [{ flow: f, index: i }] : []
    })

  return (
    <div className="sbu-viewer" role="dialog" aria-label={`${flow.name}, screen ${step + 1} of ${count}`}>
      <header className="sbu-viewer-head">
        <h1 className="sbu-viewer-title">{flow.name}</h1>
        <span className="sbu-spacer" />
        <span className="sbu-viewer-count sbu-tnum">
          {count ? step + 1 : 0} / {count}
        </span>
        <span className="sbu-spacer" />
        {themeButton}
        <IconButton variant="ghost" icon={<CloseIcon size={18} />} label="Close · Esc" onClick={onClose} />
      </header>
      {currentStep && (
        <StepBar
          key={currentStep.id}
          flow={flow}
          step={currentStep}
          play={play?.stepId === currentStep.id ? play : undefined}
          editing={editingStep}
          onEdit={setEditingStep}
          onSave={(patch) => {
            const replay = JSON.stringify(patch.actions ?? []) !== JSON.stringify(currentStep.actions ?? [])
            void updateFlow(flow.id, { steps: flow.steps.map((s) => (s.id === currentStep.id ? { ...s, ...patch } : s)) })
              .then(() => replay && reset())
              .catch((e) => pushToast({ tone: "error", title: "Couldn’t save the step", body: errorText(e) }))
          }}
        />
      )}
      <div
        ref={stage}
        className="sbu-viewer-stage"
        onScroll={(e) => e.currentTarget.scrollTo(0, 0)}
        onWheel={onWheel}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const start = touch.current
          touch.current = undefined
          if (start === undefined || busy) return
          const dx = e.changedTouches[0].clientX - start
          if (Math.abs(dx) > SWIPE) go(dx < 0 ? 1 : -1)
        }}
      >
        {scale > 0 && (
          <div className="sbu-viewer-track" style={{ height: h }}>
            {flow.steps.map((st, i) => {
              if (Math.abs(i - step) > PRELOAD) return null
              const id = storyOf(i)
              const current = i === step
              const offset = (i - step) * (w + GAP)
              return (
                <div
                  key={st.id}
                  className="sbu-viewer-slot"
                  data-current={current}
                  data-live={current && live}
                  style={{ width: w, height: h, transform: `translateX(calc(-50% + ${offset}px))` }}
                  onClick={current ? undefined : () => onStep(i)}
                  aria-hidden={!current}
                  ref={(el) => {
                    if (el) el.inert = !current
                  }}
                >
                  {id ? (
                    <div className="sbu-viewer-scale" style={{ width: d.width, height: d.height, transform: `scale(${scale})`, ["--sbu-k" as string]: scale }}>
                      <iframe
                        key={`${id}-${device}`}
                        ref={(el) => {
                          if (el) {
                            frames.current.set(st.id, el)
                            el.inert = !(current && live)
                          } else frames.current.delete(st.id)
                        }}
                        className="sbu-viewer-frame"
                        src={frameUrl(id)}
                        title={id}
                        tabIndex={current && live ? 0 : -1}
                      />
                      {current && !live && <div className="sbu-viewer-guard" title="Click to use this screen · Enter" onClick={() => setLive(true)} />}
                      {current && surface && <AnnotationLayer surface={surface} viewport={{ width: d.width, height: d.height }} marks={marks} />}
                      {current && plainSurface && (
                        <VariantLayer
                          key={`v-${id}`}
                          surface={plainSurface}
                          visible={variantsOn && !annotating}
                          onCount={setVariantCount}
                          onAskMore={(box) => {
                            savePrefs({ ...readPrefs(), mode: "variants" })
                            setVariantsOn(false)
                            onAnnotate(false)
                            const win = frameOfCurrent()?.contentWindow
                            onDraft({ surface: plainSurface, region: box.rect, viewport: { width: d.width, height: d.height }, scroll: { x: win?.scrollX ?? 0, y: win?.scrollY ?? 0 } })
                          }}
                        />
                      )}
                      {current && surface && annotating && (
                        <SketchLayer
                          key={`${id}-${sentAt}`}
                          surface={surface}
                          components={components}
                          componentThumb={componentThumb}
                          paused={draftOpen}
                          toolbarHost={tools}
                          onExit={() => onAnnotate(false)}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="sbu-viewer-missing">This screen isn’t built yet</div>
                  )}
                  {id && !ready.has(st.id) && (
                    <div className="sbu-viewer-loading">
                      <WaveCanvas mode="render" fps={30} />
                      <span className="sbu-thumb-note" data-on-waves="true">
                        <Shimmer>Rendering</Shimmer>
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
            {step > 0 && (
              <IconButton size="lg" className="sbu-viewer-nav" style={{ transform: `translateX(calc(-50% - ${w / 2 + GAP / 2}px))` }} icon={<PrevIcon size={22} />} label="Previous · ←" onClick={() => go(-1)} />
            )}
            {step < count - 1 && (
              <IconButton size="lg" className="sbu-viewer-nav" style={{ transform: `translateX(calc(-50% + ${w / 2 + GAP / 2}px))` }} icon={<NextIcon size={22} />} label="Next · →" onClick={() => go(1)} />
            )}
          </div>
        )}
      </div>
      <div ref={setTools} className="sbu-viewer-tools" />
      {noting && <FlowNote flow={flow} base={base} batch={batchCount ? batch : undefined} onClose={() => setNoting(false)} />}
      <footer className="sbu-viewer-foot">
        <span className="sbu-viewer-device">
          {d.label} ({d.width}×{d.height})
        </span>
        <div className="sbu-viewer-actions">
          <Button
            size="lg"
            icon={<AnnotateIcon size={16} />}
            on={annotating}
            onClick={() => onAnnotate(!annotating)}
            disabled={!entry}
            title="Comment on any part of the screen, or move, retype and draw on it · A"
          >
            Annotate
          </Button>
          {(variantCount > 0 || variantsOn) && (
            <Button
              size="lg"
              icon={<LayersIcon size={16} />}
              on={variantsOn}
              count={variantCount}
              onClick={() => {
                onAnnotate(false)
                setVariantsOn((v) => !v)
              }}
              title="Outline the parts of this screen that have variants, then click one to switch"
            >
              Variants
            </Button>
          )}
          <Button
            size="lg"
            variant={batchCount ? "solid" : "soft"}
            icon={<FlowNoteIcon size={16} />}
            count={batchCount || undefined}
            onClick={() => setNoting(true)}
            title={
              batchCount
                ? "Send your notes and sketches on this flow’s screens to the agent, as one request"
                : "A note about the whole flow, for every screen in it"
            }
          >
            {batchCount ? "Reconcile" : "Note on flow"}
          </Button>
          <IconButton
            size="lg"
            variant="ghost"
            icon={touring ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            label={touring ? "Stop playing the flow" : "Play the flow: every screen plays what the user does, then moves on"}
            on={touring}
            onClick={() => setTouring((v) => !v)}
          />
          {entry && <IconButton size="lg" variant="ghost" icon={<ResetIcon size={16} />} label="Replay this screen from the start · R" onClick={reset} />}
          {entry && (
            <IconButton size="lg" variant="ghost" icon={<ExternalIcon size={16} />} label="Open the full screen view" onClick={() => onOpenScreen(entry.id)} />
          )}
        </div>
        <div className="sbu-viewer-info">
          <IconButton size="lg" variant="ghost" icon={<InfoIcon size={18} />} label="Screen info and other flows" on={info} onClick={() => setInfo((v) => !v)} aria-expanded={info} />
          {info && (
            <div className="sbu-viewer-popover sbu-panel" role="dialog" aria-label="Screen info">
              <div className="sbu-viewer-pop-row">
                <div>
                  <div className="sbu-viewer-pop-label">Screen</div>
                  <div className="sbu-viewer-pop-value">{entry ? screenTitle(screen, entry) : "Not built yet"}</div>
                </div>
                {screen?.page.route && (
                  <div>
                    <div className="sbu-viewer-pop-label">Route</div>
                    <div className="sbu-viewer-pop-value sbu-mono">{screen.page.route}</div>
                  </div>
                )}
              </div>
              <div className="sbu-viewer-pop-label">Also in</div>
              <div className="sbu-viewer-chips">
                {also.length ? (
                  also.map(({ flow: f, index: i }) => (
                    <Button key={f.id} size="sm" onClick={() => onFlow(f.id, i)}>
                      {f.name}
                    </Button>
                  ))
                ) : (
                  <span className="sbu-dim">No other flows</span>
                )}
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}

// What is happening on this screen and what the user does on it, from the flow's definition; the actions light
// up as they play. Editable in place, one action per line.
function StepBar({
  flow,
  step,
  play,
  editing,
  onEdit,
  onSave,
}: {
  flow: Flow
  step: FlowStep
  play?: { index: number; results?: PlayResult[] }
  editing: boolean
  onEdit: (on: boolean) => void
  onSave: (patch: Pick<FlowStep, "note" | "actions">) => void
}) {
  const [note, setNote] = useState(step.note ?? "")
  const [actions, setActions] = useState((step.actions ?? []).map(formatAction).join("\n"))
  const described = flow.steps.some((s) => s.note || s.actions?.length)

  if (editing) {
    const save = () => {
      const parsed = parseActions(actions)
      onSave({ note: note.trim() || undefined, actions: parsed.length ? parsed : undefined })
      onEdit(false)
    }
    return (
      <form
        className="sbu-viewer-step"
        data-editing="true"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            onEdit(false)
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save()
        }}
      >
        <Input autoFocus placeholder="What is happening on this screen" value={note} onChange={(e) => setNote(e.target.value)} aria-label="What is happening on this screen" />
        <textarea
          className="sbu-input sbu-viewer-step-actions-edit"
          rows={Math.max(3, actions.split("\n").length + 1)}
          placeholder={"What the user does, one per line:\nclick Einstellungen\nclick Telefonmenü bearbeiten\ntype Name: Hauptmenü\npress Enter\nwait 800"}
          value={actions}
          onChange={(e) => setActions(e.target.value)}
          aria-label="What the user does on this screen, one action per line"
          spellCheck={false}
        />
        <div className="sbu-viewer-step-row" data-end="true">
          <span className="sbu-dim sbu-viewer-step-help">click, type Field: text, press Key, hover, scroll, wait ms · targets by their text</span>
          <Button size="sm" variant="ghost" onClick={() => onEdit(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="solid" type="submit">
            Save
          </Button>
        </div>
      </form>
    )
  }

  const stateOf = (i: number) => {
    if (!play) return "idle"
    const r = play.results?.find((x) => x.index === i)
    if (r) return r.ok ? "done" : "failed"
    if (play.results) return i < play.index ? "done" : "skipped"
    return i < play.index ? "done" : i === play.index ? "running" : "idle"
  }
  return (
    <div className="sbu-viewer-step">
      <p className="sbu-viewer-step-note">
        {step.note ?? <span className="sbu-dim">{described ? "No description for this screen yet" : "This flow’s screens aren’t described yet"}</span>}
      </p>
      {step.actions?.length ? (
        <ol className="sbu-viewer-step-actions">
          {step.actions.map((a, i) => {
            const state = stateOf(i)
            const error = play?.results?.find((x) => x.index === i)?.error
            return (
              <li key={i} data-state={state} title={error}>
                <span className="sbu-viewer-step-num">{i + 1}</span>
                {formatAction(a)}
              </li>
            )
          })}
        </ol>
      ) : null}
      <span className="sbu-viewer-step-tools">
        {!described && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void sendFlowNote(flow, DESCRIBE_STEPS).catch((e) => pushToast({ tone: "error", title: "Couldn’t start the agent", body: errorText(e) }))}
            title="Let the agent write what happens on each screen and what the user does on it"
          >
            Describe steps
          </Button>
        )}
        <IconButton size="sm" variant="ghost" icon={<EditIcon size={14} />} label="Edit what happens on this screen" onClick={() => onEdit(true)} />
      </span>
    </div>
  )
}
