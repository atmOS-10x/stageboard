import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type WheelEvent as RWheelEvent } from "react"
import { useStageboard } from "stageboard/react"
import { DEVICES, type Device, type Flow, type Region, type Sketch } from "stageboard"
import { AnnotationLayer, type Draft, type Surface } from "./annotate"
import { storyUrl } from "./api"
import { screenTitle, type ScreenNode } from "./browse"
import { FlowNote } from "./flows"
import { AnnotateIcon, CloseIcon, FlowNoteIcon, LayersIcon, NextIcon, PrevIcon, SketchIcon } from "./icons"
import { Shimmer } from "./shimmer"
import { WaveCanvas } from "./waves"
import { readPrefs, savePrefs } from "./draft-store"
import { SketchLayer } from "./sketch"
import { VariantLayer } from "./variant-layer"
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
  const [sketching, setSketching] = useState(false)
  const [info, setInfo] = useState(false)
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
  const busy = annotating || sketching || draftOpen || noting

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = box.width ? Math.min(1, (box.width * 0.72) / d.width, (box.height - 8) / d.height) : 0
  const w = d.width * scale
  const h = d.height * scale

  const go = useCallback((delta: number) => onStep(Math.max(0, Math.min(count - 1, step + delta))), [onStep, count, step])

  useEffect(() => {
    setSketching(false)
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

  useEffect(() => setReady(new Set()), [device])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.source !== "stageboard" || e.data.type !== "key" || busy) return
      if (e.data.key === "ArrowRight") go(1)
      if (e.data.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  })

  useEffect(() => {
    const onSent = () => setSketching(false)
    window.addEventListener("stageboard:sketch-sent", onSent)
    return () => window.removeEventListener("stageboard:sketch-sent", onSent)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return
      if (busy) return
      if (e.key === "ArrowRight") go(1)
      else if (e.key === "ArrowLeft") go(-1)
      else if (e.key === "Escape") onClose()
      else if (e.key === "s" || e.key === "S") setSketching(true)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [busy, go, onClose])

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
      },
    [entry, screen, frameUrl, frameOfCurrent],
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
        <button type="button" className="sbu-viewer-round" onClick={onClose} aria-label="Close" title="Close · Esc">
          <CloseIcon size={14} />
        </button>
      </header>
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
                  style={{ width: w, height: h, transform: `translateX(calc(-50% + ${offset}px))` }}
                  onClick={current ? undefined : () => onStep(i)}
                  aria-hidden={!current}
                  ref={(el) => {
                    if (el) el.inert = !current
                  }}
                >
                  {id ? (
                    <div className="sbu-viewer-scale" style={{ width: d.width, height: d.height, transform: `scale(${scale})` }}>
                      <iframe
                        key={`${id}-${device}`}
                        ref={(el) => {
                          if (el) frames.current.set(st.id, el)
                          else frames.current.delete(st.id)
                        }}
                        className="sbu-viewer-frame"
                        src={frameUrl(id)}
                        title={id}
                        tabIndex={current ? 0 : -1}
                      />
                      {current && surface && <AnnotationLayer surface={surface} viewport={{ width: d.width, height: d.height }} />}
                      {current && surface && (
                        <VariantLayer
                          key={`v-${id}`}
                          surface={surface}
                          visible={variantsOn && !sketching}
                          onCount={setVariantCount}
                          onAskMore={(box) => {
                            savePrefs({ ...readPrefs(), mode: "variants" })
                            setVariantsOn(false)
                            onAnnotate(false)
                            const win = frameOfCurrent()?.contentWindow
                            onDraft({ surface, region: box.rect, viewport: { width: d.width, height: d.height }, scroll: { x: win?.scrollX ?? 0, y: win?.scrollY ?? 0 } })
                          }}
                        />
                      )}
                      {current && surface && sketching && (
                        <SketchLayer
                          key={id}
                          surface={surface}
                          components={components}
                          componentThumb={componentThumb}
                          paused={draftOpen}
                          toolbarHost={tools}
                          onExit={() => setSketching(false)}
                          onReconcile={(sketch: Sketch, region: Region) => onDraft({ surface, region, viewport: sketch.viewport, scroll: sketch.scroll, sketch })}
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
              <button type="button" className="sbu-viewer-nav" data-side="prev" style={{ transform: `translateX(calc(-50% - ${w / 2 + GAP / 2}px))` }} onClick={() => go(-1)} aria-label="Previous screen" title="Previous · ←">
                <PrevIcon size={22} />
              </button>
            )}
            {step < count - 1 && (
              <button type="button" className="sbu-viewer-nav" data-side="next" style={{ transform: `translateX(calc(-50% + ${w / 2 + GAP / 2}px))` }} onClick={() => go(1)} aria-label="Next screen" title="Next · →">
                <NextIcon size={22} />
              </button>
            )}
          </div>
        )}
      </div>
      <div ref={setTools} className="sbu-viewer-tools">
        {annotating && !sketching && !draftOpen && (
          <div className="sbu-viewer-hint">
            Drag over the screen to annotate, or click a spot <span className="sbu-key">esc</span>
          </div>
        )}
      </div>
      {noting && <FlowNote flow={flow} base={base} onClose={() => setNoting(false)} />}
      <footer className="sbu-viewer-foot">
        <span className="sbu-viewer-device">
          {d.label} ({d.width}×{d.height})
        </span>
        <div className="sbu-viewer-actions">
          <button type="button" className="sbu-viewer-pill" data-on={annotating} onClick={() => onAnnotate(!annotating)} disabled={!entry}>
            <AnnotateIcon size={14} /> Annotate <span className="sbu-key">A</span>
          </button>
          <button
            type="button"
            className="sbu-viewer-pill"
            data-on={sketching}
            onClick={() => {
              onAnnotate(false)
              setSketching((v) => !v)
            }}
            disabled={!entry}
          >
            <SketchIcon size={14} /> Sketch <span className="sbu-key">S</span>
          </button>
          {(variantCount > 0 || variantsOn) && (
            <button
              type="button"
              className="sbu-viewer-pill"
              data-on={variantsOn}
              onClick={() => {
                setSketching(false)
                setVariantsOn((v) => !v)
              }}
              title="Outline the parts of this screen that have variants, then click one to switch"
            >
              <LayersIcon size={14} /> Variants <span className="sbu-count">{variantCount}</span>
            </button>
          )}
          <button
            type="button"
            className="sbu-viewer-pill"
            onClick={() => {
              onAnnotate(false)
              setSketching(false)
              setNoting(true)
            }}
            title="A note about the whole flow, for every screen in it"
          >
            <FlowNoteIcon size={14} /> Note on flow
          </button>
          {entry && (
            <button type="button" className="sbu-viewer-pill" data-quiet="true" onClick={() => onOpenScreen(entry.id)} title="Open the full screen view: variants, inspect, sizes">
              Open screen
            </button>
          )}
        </div>
        <div className="sbu-viewer-info">
          <button type="button" className="sbu-viewer-more" onClick={() => setInfo((v) => !v)} aria-expanded={info}>
            More info
          </button>
          {info && (
            <div className="sbu-viewer-popover" role="dialog" aria-label="Screen info">
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
                    <button key={f.id} type="button" className="sbu-viewer-chip" onClick={() => onFlow(f.id, i)}>
                      {f.name}
                    </button>
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
