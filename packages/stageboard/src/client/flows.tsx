import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { createPortal } from "react-dom"
import { createDream, createFlow, removeFlow, submitChangeRequest, updateFlow, useStageboard } from "stageboard/react"
import { DEVICES, type Device, type Flow, type FlowStep } from "stageboard"
import { groupBy, screenGroup, STORY_MIME, screenTitle, type ScreenNode } from "./browse"
import { markReveal, pendingReveals } from "./dreams"
import { CloseIcon, FlowNoteIcon, PlusIcon, PrevIcon } from "./icons"
import { Thumb } from "./thumb"
import type { ClientEntry } from "./types"
import { Button, IconButton, Input } from "./kit"
import { PromptInput } from "./prompt-input"
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
  base: string
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
          <Button size="sm" variant="ghost" disabled={suggesting} onClick={suggest} title="Let the agent propose more flows from your screens">
            {suggesting ? "Suggesting…" : "Suggest flows"}
          </Button>
        )}
        <Button size="sm" icon={<PlusIcon size={14} />} on={composing} onClick={() => onCompose(!composing)}>
          New flow
        </Button>
      </div>
      {composing && <NewFlow base={ctx.base} onClose={() => onCompose(false)} />}
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
                  <Button size="lg" variant="solid" className="sbu-flows-hero-go" onClick={suggest}>
                    Suggest flows
                  </Button>
                  <Button variant="link" onClick={() => onCompose(true)}>
                    or describe one yourself
                  </Button>
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

function NewFlow({ base, onClose }: { base: string; onClose: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  return (
    <div className="sbu-newflow">
      <PromptInput
        base={base}
        value={description}
        onChange={setDescription}
        onClose={onClose}
        label="Describe the flow"
        placeholder="Describe the journey: who starts where, what they do, where they end up. The agent picks your screens and builds the missing ones."
        head={<input className="sbu-prompt-title" placeholder="New flow" value={name} onChange={(e) => setName(e.target.value)} aria-label="Flow name (optional)" />}
        bar={
          name.trim() && !description.trim() ? (
            <Button
              size="sm"
              onClick={() =>
                void createFlow({ name })
                  .then(onClose)
                  .catch((e) => pushToast({ tone: "error", title: "Couldn’t create the flow", body: errorText(e) }))
              }
            >
              Create empty, I’ll add screens
            </Button>
          ) : null
        }
        onSubmit={async (uploads) => {
          await createFlow({ name, description, assemble: true, attachments: uploads.map((u) => u.id) })
          onClose()
        }}
      />
    </div>
  )
}

export function FlowNote({ flow, base, onClose }: { flow: Flow; base: string; onClose: () => void }) {
  const [note, setNote] = useState("")
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return createPortal(
    <div className="sbu-picker-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sbu-note-dialog" role="dialog" aria-label={`Note on ${flow.name}`}>
        <PromptInput
          base={base}
          value={note}
          onChange={setNote}
          onClose={onClose}
          minRows={4}
          label="Note on the whole flow"
          placeholder="What should change across this flow? For example the order of screens, a step that is missing, or wording that should match everywhere."
          head={
            <span className="sbu-prompt-context">
              Whole flow · <strong>{flow.name}</strong> · {flow.steps.length} screen{flow.steps.length === 1 ? "" : "s"}
            </span>
          }
          onSubmit={async (uploads) => {
            await submitChangeRequest({
              kind: "edit",
              note: note.trim(),
              flow,
              attachments: uploads.map((u) => u.id),
              target: { url: "", title: flow.name, selector: "", tag: "flow", rect: { x: 0, y: 0, width: 0, height: 0 }, viewport: { width: 1440, height: 900 }, components: [], storyId: flow.steps.find((s) => s.storyId)?.storyId },
            })
            pushToast({ tone: "info", title: "Sent to the agent", body: `Your note on “${flow.name}” is being worked on.` })
            onClose()
          }}
        />
      </div>
    </div>,
    document.body,
  )
}

function FlowStrip({ flow, ctx, focused }: { flow: Flow; ctx: Ctx; focused: boolean }) {
  const [renaming, setRenaming] = useState(false)
  const [noting, setNoting] = useState(false)
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
                onNew={async (prompt, attachments) => {
                  const parent = [...steps.slice(0, adding)].reverse().find((s) => s.storyId)?.storyId
                  const dream = await createDream({ prompt, parent, attachments, flow: { id: flow.id, index: adding } })
                  markReveal(dream.id, true)
                  setAdding(undefined)
                }}
              />
            )}
          </div>
        </div>
      </div>
      {noting && <FlowNote flow={flow} base={ctx.base} onClose={() => setNoting(false)} />}
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
              <Button variant="link" onClick={() => void updateFlow(flow.id, { retry: true })}>
                Try again
              </Button>
            </>
          ) : (
            `${steps.length} screen${steps.length === 1 ? "" : "s"}`
          )}
          <span className="sbu-flow-actions">
            <Button size="sm" variant="ghost" icon={<FlowNoteIcon size={13} />} onClick={() => setNoting(true)}>
              Note on flow
            </Button>
            <Button size="sm" variant="ghost" onClick={() => confirm(`Delete the flow “${flow.name}”? Its screens stay.`) && void removeFlow(flow.id)}>
              Delete
            </Button>
          </span>
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

function AddStep({ ctx, onClose, onPick, onNew }: { ctx: Ctx; onClose: () => void; onPick: (storyId: string) => void; onNew: (prompt: string, attachments: string[]) => Promise<void> }) {
  const [q, setQ] = useState("")
  const [describing, setDescribing] = useState(false)
  const [prompt, setPrompt] = useState("")
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

  return createPortal(
    <div className="sbu-picker-scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sbu-picker sbu-panel" role="dialog" aria-label="Add a screen to the flow" data-device={ctx.device}>
        <div className="sbu-picker-head">
          {describing ? (
            <span className="sbu-picker-title">New screen</span>
          ) : (
            <Input
              size="lg"
              placeholder="Find a screen"
              value={q}
              autoFocus
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shown[0]) onPick(shown[0].entry.id)
              }}
            />
          )}
          <IconButton variant="ghost" icon={<CloseIcon size={16} />} label="Close · Esc" onClick={onClose} />
        </div>
        {describing ? (
          <div className="sbu-picker-describe">
            <PromptInput
              base={ctx.base}
              value={prompt}
              onChange={setPrompt}
              onClose={() => setDescribing(false)}
              minRows={4}
              label="Describe the new screen"
              placeholder="What should this screen show? The agent builds it next to the screen before it in the flow."
              head={
                <Button size="sm" variant="ghost" icon={<PrevIcon size={14} />} onClick={() => setDescribing(false)}>
                  Screens
                </Button>
              }
              onSubmit={(uploads) => onNew(prompt, uploads.map((u) => u.id))}
            />
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
