import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { createDream, createFlow, removeFlow, updateFlow, useStageboard } from "stageboard/react"
import { DEVICES, type Device, type Flow, type FlowStep } from "stageboard"
import { STORY_MIME, screenTitle, type ScreenNode } from "./browse"
import { markReveal, pendingReveals } from "./dreams"
import { ArrowUpIcon, CloseIcon, PlusIcon } from "./icons"
import { Thumb } from "./thumb"
import type { ClientEntry } from "./types"
import { WaveCanvas } from "./waves"

const STEP_MIME = "application/x-stageboard-step"

type Ctx = {
  device: Device
  screens: ScreenNode[]
  index: ClientEntry[]
  thumbUrl: (id: string) => string
  frameUrl: (id: string) => string
  onOpen: (id: string) => void
}

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

export function FlowsView({ ctx, focus, composing, onCompose }: { ctx: Ctx; focus?: string; composing: boolean; onCompose: (on: boolean) => void }) {
  const flows = useStageboard((s) => s.flows)
  const suggesting = useStageboard((s) => s.jobs.some((j) => j.kind === "flow" && !j.flow && (j.status === "queued" || j.status === "running")))
  useEffect(() => {
    if (focus) document.getElementById(`flow-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [focus])

  return (
    <div className="sbu-flows" data-device={ctx.device}>
      <div className="sbu-flows-head">
        <h1>Flows</h1>
        <span className="sbu-dim">{flows.length}</span>
        <span className="sbu-spacer" />
        <button className="sbu-btn" disabled={suggesting} onClick={() => void createFlow({ suggest: true })} title="Let the agent propose the main flows from your screens">
          {suggesting ? "Suggesting…" : "Suggest flows"}
        </button>
        <button className="sbu-btn" data-on={composing} onClick={() => onCompose(!composing)}>
          <PlusIcon size={13} /> New flow
        </button>
      </div>
      {composing && <NewFlow onClose={() => onCompose(false)} />}
      {!flows.length && !composing && (
        <div className="sbu-flows-empty">
          <p className="sbu-gallery-empty-title">No flows yet</p>
          <p>Describe a journey through the app and the agent puts it together from your screens, building the ones that are missing. Or let it suggest the main flows.</p>
          {suggesting && (
            <div className="sbu-flows-suggesting">
              <WaveCanvas mode="render" fps={30} />
            </div>
          )}
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
      setError((e as Error).message.replace(/^\d+\s*/, ""))
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
      <div className="sbu-flow-head">
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
        <span className="sbu-dim">
          {steps.length} screen{steps.length === 1 ? "" : "s"}
        </span>
        {flow.group && <span className="sbu-chip">{flow.group}</span>}
        {assembling && (
          <span className="sbu-chip" data-tone="busy">
            <span className="sbu-spin" /> Assembling
          </span>
        )}
        {flow.status === "failed" && <span className="sbu-chip" data-tone="warn">Didn’t finish</span>}
        <span className="sbu-spacer" />
        <button type="button" className="sbu-icon" onClick={() => confirm(`Delete the flow “${flow.name}”? Its screens stay.`) && void removeFlow(flow.id)} aria-label="Delete flow" title="Delete flow">
          <CloseIcon size={13} />
        </button>
      </div>
      {flow.description && <p className="sbu-flow-desc">{flow.description}</p>}
      <div className="sbu-flow-row" onDragLeave={() => setOver(undefined)}>
        {steps.map((step, i) => (
          <div key={step.id} className="sbu-flow-cell" data-over={over === i} onDragOver={allow(i)} onDrop={onDrop(i)}>
            {i > 0 && <span className="sbu-flow-arrow" aria-hidden="true" />}
            <StepCard flow={flow} step={step} index={i} ctx={ctx} onRemove={() => setSteps(steps.filter((s) => s.id !== step.id))} />
          </div>
        ))}
        {assembling && !steps.length &&
          [0, 1, 2].map((i) => (
            <div key={`ph-${i}`} className="sbu-flow-cell">
              {i > 0 && <span className="sbu-flow-arrow" aria-hidden="true" />}
              <div className="sbu-step">
                <div className="sbu-shot" style={{ aspectRatio: `${DEVICES[ctx.device].width} / ${DEVICES[ctx.device].height}` }}>
                  <WaveCanvas mode="render" fps={30} />
                </div>
              </div>
            </div>
          ))}
        <div className="sbu-flow-cell" data-over={over === steps.length} onDragOver={allow(steps.length)} onDrop={onDrop(steps.length)}>
          {steps.length > 0 && <span className="sbu-flow-arrow" data-ghost="true" aria-hidden="true" />}
          <div className="sbu-step sbu-step-add">
            <button
              type="button"
              className="sbu-shot sbu-add-shot"
              style={{ aspectRatio: `${DEVICES[ctx.device].width} / ${DEVICES[ctx.device].height}` }}
              onClick={() => setAdding(adding === undefined ? steps.length : undefined)}
            >
              <PlusIcon size={18} />
              <span>Add a screen</span>
              <span className="sbu-dim">or drop one here</span>
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
      <div className="sbu-shot" style={{ aspectRatio: `${d.width} / ${d.height}` }} onClick={() => entry && ctx.onOpen(entry.id)} data-missing={!entry && !waiting}>
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
      <div className="sbu-card-caption">
        <span className="sbu-step-n sbu-tnum">{index + 1}</span>
        <span className="sbu-card-title">{title}</span>
      </div>
      {step.note && <div className="sbu-card-sub">{step.note}</div>}
    </div>
  )
}

function AddStep({ ctx, onClose, onPick, onNew }: { ctx: Ctx; onClose: () => void; onPick: (storyId: string) => void; onNew: (prompt: string) => Promise<void> }) {
  const [q, setQ] = useState("")
  const [describing, setDescribing] = useState(false)
  const [prompt, setPrompt] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const shown = useMemo(
    () => ctx.screens.filter((s) => !q || `${s.page.title ?? ""} ${s.entry.title} ${s.entry.name} ${s.page.route}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40),
    [ctx.screens, q],
  )
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener("pointerdown", onDown, true)
    return () => window.removeEventListener("pointerdown", onDown, true)
  }, [onClose])
  return (
    <div ref={ref} className="sbu-addstep" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      {describing ? (
        <>
          <textarea
            className="sbu-dream-prompt"
            autoFocus
            placeholder="What should this new screen show?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
                e.preventDefault()
                void onNew(prompt)
              }
            }}
          />
          <div className="sbu-dream-bar">
            <button type="button" className="sbu-ghost" onClick={() => setDescribing(false)}>
              Back
            </button>
            <span className="sbu-spacer" />
            <button type="button" className="sbu-send" disabled={!prompt.trim()} onClick={() => void onNew(prompt)} aria-label="Build this screen">
              <ArrowUpIcon size={14} />
            </button>
          </div>
        </>
      ) : (
        <>
          <input className="sbu-sketch-filter" placeholder="Find a screen" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <button type="button" className="sbu-addstep-new" onClick={() => setDescribing(true)}>
            <PlusIcon size={13} /> New screen, built by the agent
          </button>
          <ul>
            {shown.map((s) => (
              <li key={s.entry.id}>
                <button type="button" onClick={() => onPick(s.entry.id)}>
                  <span>{s.page.title ?? s.entry.name}</span>
                  <span className="sbu-dim">{s.page.route}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="sbu-dim">No screens match</li>}
          </ul>
        </>
      )}
    </div>
  )
}
