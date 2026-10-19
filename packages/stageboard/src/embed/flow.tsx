import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { DEVICES } from "../core/protocol"
import { CloseIcon, ExternalIcon } from "../client/icons"
import { IconButton } from "../client/kit"
import { ReferenceList, ReferenceShot } from "../client/references"
import { ViewerStage } from "../client/viewer-stage"
import type { EmbedFlow, EmbedStep } from "./data"

type Mode = "inline" | "fullscreen"

const readMode = (): Mode => (document.documentElement.dataset.displayMode === "fullscreen" ? "fullscreen" : "inline")

function useDisplayMode(): Mode {
  const [mode, setMode] = useState(readMode)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data
      if (d?.jsonrpc === "2.0" && d.method === "ui/notifications/host-context-changed" && d.params?.displayMode) setMode(d.params.displayMode === "fullscreen" ? "fullscreen" : "inline")
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])
  return mode
}

function useViewportHeight(on: boolean): number | undefined {
  const [height, setHeight] = useState(() => window.innerHeight)
  useEffect(() => {
    if (!on) return
    const onResize = () => setHeight(window.innerHeight)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [on])
  return on ? height : undefined
}

function Screen({ flow, step }: { flow: EmbedFlow; step: EmbedStep }) {
  if (step.image === undefined) return <span className="sbu-step-missing">Not built yet</span>
  const src = flow.images[step.image]
  if (step.reference) return <ReferenceShot src={src} reference={{ ...step.references[0], image: src }} />
  return (
    <div className="sbu-thumb" data-state="ready">
      <img className="sbu-thumb-img" src={src} alt="" draggable={false} />
    </div>
  )
}

function Strip({ flow, onOpen }: { flow: EmbedFlow; onOpen: (index: number) => void }) {
  const d = DEVICES[flow.device]
  return (
    <section className="sbu-flow">
      <div className="sbu-flow-row">
        {flow.steps.map((step, i) => (
          <div key={step.id} className="sbu-flow-cell">
            <div className="sbu-step">
              <button type="button" className="sbu-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }} data-missing={step.image === undefined} onClick={() => onOpen(i)} aria-label={`${i + 1}. ${step.title}`} title={step.title}>
                <Screen flow={flow} step={step} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="sbu-flow-foot">
        <h2 className="sbu-flow-name">{flow.name}</h2>
        <div className="sbu-flow-count">
          {flow.steps.length} screen{flow.steps.length === 1 ? "" : "s"}
        </div>
      </div>
    </section>
  )
}

function Viewer({ flow, step, embedded, mode, onStep, onClose }: { flow: EmbedFlow; step: number; embedded: boolean; mode: Mode; onStep: (index: number) => void; onClose: () => void }) {
  const current = flow.steps[step]
  const count = flow.steps.length
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "ArrowRight") onStep(Math.min(count - 1, step + 1))
      else if (e.key === "ArrowLeft") onStep(Math.max(0, step - 1))
      else if (e.key === "Escape") onClose()
      else return
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [step, count, onStep, onClose])
  return (
    <div className="sbu-viewer" role="dialog" aria-label={`${flow.name}, screen ${step + 1} of ${count}`}>
      <header className="sbu-viewer-head">
        <h1 className="sbu-viewer-title">{flow.name}</h1>
        <span className="sbu-spacer" />
        <span className="sbu-viewer-count sbu-tnum">
          {step + 1} / {count}
        </span>
        <span className="sbu-spacer" />
        {embedded && mode === "inline" && (
          <IconButton
            variant="ghost"
            icon={<ExternalIcon size={16} />}
            label="Open larger"
            onClick={() => parent.postMessage({ jsonrpc: "2.0", method: "ui/request-display-mode", params: { mode: "fullscreen" } }, "*")}
          />
        )}
        <IconButton variant="ghost" icon={<CloseIcon size={18} />} label="Back to the flow · Esc" onClick={onClose} />
      </header>
      {(current.note || current.references.length > 0) && (
        <div className="sbu-viewer-step">
          {current.note && <p className="sbu-viewer-step-note">{current.note}</p>}
          {current.references.length > 0 && <ReferenceList references={current.references} srcOf={(image) => flow.images[image]} />}
        </div>
      )}
      <ViewerStage
        steps={flow.steps.map((s) => s.id)}
        step={step}
        frame={DEVICES[flow.device]}
        busy={false}
        onStep={onStep}
        slot={(i) => ({ content: <Screen flow={flow} step={flow.steps[i]} /> })}
      />
    </div>
  )
}

function App({ flow }: { flow: EmbedFlow }) {
  const mode = useDisplayMode()
  const height = useViewportHeight(mode === "fullscreen")
  const [open, setOpen] = useState<number>()
  return (
    <div className="sbu-embed-body" data-mode={mode} data-view={open === undefined ? "flow" : "viewer"} data-device={flow.device} style={height ? { height } : undefined}>
      {open === undefined ? (
        <div className="sbu-flows" data-device={flow.device}>
          <Strip flow={flow} onOpen={setOpen} />
        </div>
      ) : (
        <Viewer flow={flow} step={open} embedded={window.parent !== window} mode={mode} onStep={setOpen} onClose={() => setOpen(undefined)} />
      )}
    </div>
  )
}

export function mountFlowEmbed(root: HTMLElement) {
  const data = JSON.parse(root.querySelector("script[type='application/json']")!.textContent!) as EmbedFlow
  const host = document.createElement("div")
  root.appendChild(host)
  createRoot(host).render(<App flow={data} />)
}
