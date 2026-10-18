import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { createPortal } from "react-dom"
import { createDream, createFlow, removeFlow, updateFlow, useStageboard } from "stageboard/react"
import { DEVICES, type Device, type Flow, type FlowStep } from "stageboard"
import { groupBy, screenGroup, STORY_MIME, screenTitle, type ScreenNode } from "./browse"
import { markReveal, pendingReveals } from "./dreams"
import { ArrowUpIcon, CloseIcon, PlusIcon } from "./icons"
import { Thumb } from "./thumb"
import type { ClientEntry } from "./types"
import { Shimmer } from "./shimmer"
import { errorText, pushToast } from "./toasts"
import { WaveCanvas } from "./waves"

const STEP_MIME = "application/x-stageboard-step"

type Ctx = {
  device: Device
  screens: ScreenNode[]
  index: ClientEntry[]
  thumbUrl: (id: string) => string
  frameUrl: (id: string) => string
  onOpen: (id: string) => void
  onStep: (flowId: string, index: number) => void
}

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

export type FlowCtx = Ctx

export function FlowsView({ ctx, focus, composing, onCompose }: { ctx: Ctx; focus?: string; composing: boolean; onCompose: (on: boolean) => void }) {
  const flows = useStageboard((s) => s.flows)
  const suggestJob = useStageboard((s) => s.jobs.filter((j) => j.kind === "flow" && !j.flow && (j.status === "queued" || j.status === "running")).at(-1))
  const suggesting = Boolean(suggestJob)
  const suggest = () => void createFlow({ suggest: true }).catch((e) => pushToast({ tone: "error", title: "Couldn’t start the agent", body: errorText(e) }))
  useEffect(() => {
    if (focus) document.getElementById(`flow-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [focus])

  return (
    <div className="sbu-flows" data-device={ctx.device}>
      <div className="sbu-flows-head">
        <h1>Flows</h1>
        <span className="sbu-dim">{flows.length}</span>
        <span className="sbu-spacer" />
        {flows.length > 0 && (
          <button className="sbu-btn" disabled={suggesting} onClick={suggest} title="Let the agent propose more flows from your screens">
            {suggesting ? "Suggesting…" : "Suggest flows"}
          </button>
        )}
        <button className="sbu-btn" data-on={composing} onClick={() => onCompose(!composing)}>
          <PlusIcon size={13} /> New flow
        </button>
      </div>
      {composing && <NewFlow onClose={() => onCompose(false)} />}
      {!flows.length && !composing && (
        <div className="sbu-flows-hero">
          <div className="sbu-flows-hero-card" data-busy={suggesting}>
            <WaveCanvas mode="render" fps={30} />
            <div className="sbu-flows-hero-text">
              {suggesting ? (
                <>
                  <p className="sbu-flows-hero-title">
                    <Shimmer>Suggesting flows</Shimmer>
                  </p>
                  <p className="sbu-flows-hero-log">{suggestJob?.log.at(-1) ?? "Starting the agent…"}</p>
                </>
              ) : (
                <>
                  <p className="sbu-flows-hero-title">No flows yet</p>
                  <p>The agent reads your screens and routes and lays out the main journeys through the app, building screens that are missing.</p>
                  <button type="button" className="sbu-flows-hero-go" onClick={suggest}>
                    Suggest flows
                  </button>
                  <button type="button" className="sbu-flows-hero-alt" onClick={() => onCompose(true)}>
                    or describe one yourself
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {flows.map((flow) => (
        <FlowStrip key={flow.id} flow={flow} ctx={ctx} focused={focus === flow.id} />
      ))}
    </div>
  )
}

function NewFlow({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [group, setGroup] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()
  const send = async (assemble: boolean) => {
    if (sending || (!name.trim() && !description.trim())) return
    setSending(true)
    try {
      await createFlow({ name, description, group, assemble: assemble && Boolean(description.trim()) })
      onClose()
    } catch (e) {
      setError(errorText(e))
      setSending(false)
    }
  }
  return (
    <div
      className="sbu-newflow"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose()
        if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).tagName === "TEXTAREA") {
          e.preventDefault()
          void send(true)
        }
      }}
    >
      <div className="sbu-newflow-row">
        <input className="sbu-newflow-name" placeholder="Flow name, e.g. Approving a prescription" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <input className="sbu-newflow-group" placeholder="Group (optional)" value={group} onChange={(e) => setGroup(e.target.value)} />
      </div>
      <textarea
        className="sbu-dream-prompt"
        placeholder="Describe the journey: who starts where, what they do, where they end up. The agent picks existing screens and builds missing ones."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && <div className="sbu-composer-error">{error}</div>}
      <div className="sbu-dream-bar">
        <button type="button" className="sbu-ghost" onClick={() => void send(false)} disabled={sending || !name.trim()}>
          Empty flow, I’ll add screens
        </button>
        <span className="sbu-spacer" />
        <button type="button" className="sbu-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="sbu-send" disabled={sending || !description.trim()} onClick={() => void send(true)} aria-label="Assemble with the agent" title="Assemble with the agent · Enter">
          {sending ? <span className="sbu-spin" /> : <ArrowUpIcon size={14} />}
        </button>
      </div>
    </div>
  )
}

function FlowStrip({ flow, ctx, focused }: { flow: Flow; ctx: Ctx; focused: boolean }) {
  const [renaming, setRenaming] = useState(false)
  const [adding, setAdding] = useState<number>()
  const [over, setOver] = useState<number>()
  const steps = flow.steps
  const assembling = flow.status === "assembling"

  const setSteps = (next: FlowStep[]) => void updateFlow(flow.id, { steps: next })
  const insertAt = (index: number, step: FlowStep) => setSteps([...steps.slice(0, index), step, ...steps.slice(index)])

  const onDrop = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    setOver(undefined)
    const from = e.dataTransfer.getData(STEP_MIME)
    if (from) {
      const [flowId, stepId] = from.split(":")
      if (flowId === flow.id) {
        const moving = steps.find((s) => s.id === stepId)
        if (!moving) return
        const rest = steps.filter((s) => s.id !== stepId)
        const at = Math.min(rest.length, index > steps.indexOf(moving) ? index - 1 : index)
        setSteps([...rest.slice(0, at), moving, ...rest.slice(at)])
        return
      }
    }
    const storyId = e.dataTransfer.getData(STORY_MIME)
    if (storyId) insertAt(index, { id: newId(), storyId })
  }

  const allow = (index: number) => (e: DragEvent) => {
    const types = Array.from(e.dataTransfer.types)
    if (!types.includes(STEP_MIME) && !types.includes(STORY_MIME)) return
    e.preventDefault()
    setOver(index)
  }

  return (
    <section id={`flow-${flow.id}`} className="sbu-flow" data-focus={focused}>
      <div className="sbu-flow-row" onDragLeave={() => setOver(undefined)}>
        {steps.map((step, i) => (
          <div key={step.id} className="sbu-flow-cell" data-over={over === i} onDragOver={allow(i)} onDrop={onDrop(i)}>
            <StepCard flow={flow} step={step} index={i} ctx={ctx} onRemove={() => setSteps(steps.filter((s) => s.id !== step.id))} />
          </div>
        ))}
        {assembling && !steps.length &&
          [0, 1, 2].map((i) => (
            <div key={`ph-${i}`} className="sbu-flow-cell">
              <div className="sbu-step">
                <div className="sbu-shot" style={{ aspectRatio: `${DEVICES[ctx.device].width} / ${DEVICES[ctx.device].height}` }}>
                  <WaveCanvas mode="render" fps={30} />
                </div>
              </div>
            </div>
          ))}
        <div className="sbu-flow-cell" data-over={over === steps.length} onDragOver={allow(steps.length)} onDrop={onDrop(steps.length)}>
          <div className="sbu-step sbu-step-add">
            <button
              type="button"
              className="sbu-shot sbu-add-shot"
              style={{ aspectRatio: `${DEVICES[ctx.device].width} / ${DEVICES[ctx.device].height}` }}
              onClick={() => setAdding(adding === undefined ? steps.length : undefined)}
              aria-label="Add a screen"
              title="Add a screen, or drop one here"
            >
              <PlusIcon size={18} />
            </button>
            {adding !== undefined && (
              <AddStep
                ctx={ctx}
                onClose={() => setAdding(undefined)}
                onPick={(storyId) => {
                  insertAt(adding, { id: newId(), storyId })
                  setAdding(undefined)
                }}
                onNew={async (prompt) => {
                  const parent = [...steps.slice(0, adding)].reverse().find((s) => s.storyId)?.storyId
                  const dream = await createDream({ prompt, parent, flow: { id: flow.id, index: adding } })
                  markReveal(dream.id, true)
                  setAdding(undefined)
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="sbu-flow-foot">
        {renaming ? (
          <input
            className="sbu-flow-rename"
            defaultValue={flow.name}
            autoFocus
            onBlur={(e) => {
              setRenaming(false)
              if (e.target.value.trim() && e.target.value !== flow.name) void updateFlow(flow.id, { name: e.target.value })
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") setRenaming(false)
            }}
          />
        ) : (
          <h2 className="sbu-flow-name" onDoubleClick={() => setRenaming(true)} title="Double-click to rename">
            {flow.name}
          </h2>
        )}
        <div className="sbu-flow-count">
          {assembling ? (
            <Shimmer>Assembling…</Shimmer>
          ) : flow.status === "failed" ? (
            <>
              Didn’t finish ·{" "}
              <button type="button" className="sbu-link" onClick={() => void updateFlow(flow.id, { retry: true })}>
                Try again
              </button>
            </>
          ) : (
            `${steps.length} screen${steps.length === 1 ? "" : "s"}`
          )}
          <button type="button" className="sbu-link sbu-flow-delete" onClick={() => confirm(`Delete the flow “${flow.name}”? Its screens stay.`) && void removeFlow(flow.id)}>
            Delete
          </button>
        </div>
      </div>
    </section>
  )
}

function StepCard({ flow, step, index, ctx, onRemove }: { flow: Flow; step: FlowStep; index: number; ctx: Ctx; onRemove: () => void }) {
  const dreams = useStageboard((s) => s.dreams)
  const d = DEVICES[ctx.device]
  const dream = step.dream ? dreams.find((x) => x.id === step.dream) : undefined
  const realized = step.dream ? ctx.screens.find((s) => s.page.dream === step.dream) : undefined
  const storyId = step.storyId ?? realized?.entry.id ?? dream?.storyId
  const entry = storyId ? ctx.index.find((e) => e.id === storyId) : undefined
  const screen = storyId ? ctx.screens.find((s) => s.entry.id === storyId) : undefined
  const waiting = !entry && (step.pending || (dream && dream.status === "rendering"))
  const [reveal, setReveal] = useState(false)
  const was = useRef(Boolean(waiting))
  useEffect(() => {
    if (entry && (was.current || (step.dream && pendingReveals().includes(step.dream)))) {
      setReveal(true)
      if (step.dream) markReveal(step.dream, false)
    }
    was.current = Boolean(waiting)
  }, [Boolean(entry), Boolean(waiting)])

  const title = entry ? screenTitle(screen, entry) : step.pending ?? dream?.name ?? dream?.prompt ?? "Missing screen"
  return (
    <div
      className="sbu-step"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(STEP_MIME, `${flow.id}:${step.id}`)
        e.dataTransfer.effectAllowed = "move"
      }}
    >
      <div className="sbu-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }} onClick={() => entry && ctx.onStep(flow.id, index)} data-missing={!entry && !waiting} aria-label={title} role="button">
        {entry && <Thumb src={ctx.thumbUrl(entry.id)} />}
        {waiting && <WaveCanvas mode="render" fps={30} />}
        {reveal && (
          <div className="sbu-step-reveal">
            <WaveCanvas mode="reveal" onDone={() => setReveal(false)} />
          </div>
        )}
        {!entry && !waiting && <span className="sbu-step-missing">{dream?.status === "failed" ? "The agent didn’t finish this screen" : "Screen not found"}</span>}
        <button
          type="button"
          className="sbu-step-x"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label="Remove from flow"
          title="Remove from flow"
        >
          <CloseIcon size={10} />
        </button>
      </div>
    </div>
  )
}

function AddStep({ ctx, onClose, onPick, onNew }: { ctx: Ctx; onClose: () => void; onPick: (storyId: string) => void; onNew: (prompt: string) => Promise<void> }) {
  const [q, setQ] = useState("")
  const [describing, setDescribing] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [sending, setSending] = useState(false)
  const d = DEVICES[ctx.device]
  const shown = useMemo(
    () => ctx.screens.filter((s) => !q || `${s.page.title ?? ""} ${s.entry.title} ${s.entry.name} ${s.page.route} ${s.page.group ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    [ctx.screens, q],
  )
  const groups = useMemo(() => groupBy(shown, screenGroup), [shown])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation()
      if (describing) setDescribing(false)
      else onClose()
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [describing, onClose])

  const build = async () => {
    if (!prompt.trim() || sending) return
    setSending(true)
    await onNew(prompt).catch((e) => {
      setSending(false)
      pushToast({ tone: "error", title: "Couldn’t start the agent", body: errorText(e) })
    })
  }

  return createPortal(
    <div className="sbu-picker-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sbu-picker" role="dialog" aria-label="Add a screen to the flow" data-device={ctx.device}>
        <div className="sbu-picker-head">
          {describing ? (
            <span className="sbu-picker-title">New screen, built by the agent</span>
          ) : (
            <input
              className="sbu-picker-search"
              placeholder="Find a screen"
              value={q}
              autoFocus
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shown[0]) onPick(shown[0].entry.id)
              }}
            />
          )}
          <button type="button" className="sbu-viewer-round" onClick={onClose} aria-label="Close" title="Close · Esc">
            <CloseIcon size={14} />
          </button>
        </div>
        {describing ? (
          <div className="sbu-picker-describe">
            <textarea
              className="sbu-picker-prompt"
              autoFocus
              placeholder="What should this screen show? The agent builds it as a page story next to the screen before it in the flow."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void build()
                }
              }}
            />
            <div className="sbu-dream-bar">
              <button type="button" className="sbu-ghost" onClick={() => setDescribing(false)}>
                Back to screens
              </button>
              <span className="sbu-spacer" />
              <button type="button" className="sbu-send" disabled={!prompt.trim() || sending} onClick={() => void build()} aria-label="Build this screen">
                {sending ? <span className="sbu-spin" /> : <ArrowUpIcon size={14} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="sbu-picker-body">
            <button type="button" className="sbu-picker-new" onClick={() => setDescribing(true)}>
              <span className="sbu-picker-new-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }}>
                <WaveCanvas mode="render" fps={24} />
                <PlusIcon size={22} />
              </span>
              <span className="sbu-picker-name">New screen</span>
            </button>
            {groups.map(([group, list]) => (
              <section key={group} className="sbu-picker-group">
                <h3>{group}</h3>
                <div className="sbu-picker-grid">
                  {list.map((s) => (
                    <button key={s.entry.id} type="button" className="sbu-picker-item" onClick={() => onPick(s.entry.id)} title={s.page.route}>
                      <span className="sbu-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }}>
                        <Thumb src={ctx.thumbUrl(s.entry.id)} />
                      </span>
                      <span className="sbu-picker-name">{screenTitle(s)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {!shown.length && <p className="sbu-dim">No screens match “{q}”.</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
