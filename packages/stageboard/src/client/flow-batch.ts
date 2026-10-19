import { useSyncExternalStore } from "react"
import type { Flow, FlowAnnotation, Region, Upload } from "@atmos.build/stageboard"
import { readSketch } from "./sketch"

// While annotating a flow in the viewer, comments collect here per flow instead of going out one by one; sketches
// already live per screen (see sketch.tsx). Reconcile sends them all as one note on the flow.
export type BatchComment = { id: string; storyId: string; title: string; step: number; note: string; region: Region; viewport: { width: number; height: number }; scroll?: { x: number; y: number }; attachments: Upload[] }

const KEY = (flowId: string) => `stageboard:flow-batch:${flowId}`
const listeners = new Set<() => void>()
let version = 0

export function notifyBatch() {
  version++
  for (const l of listeners) l()
}

export function readComments(flowId: string): BatchComment[] {
  try {
    return JSON.parse(localStorage.getItem(KEY(flowId)) ?? "[]")
  } catch {
    return []
  }
}

function write(flowId: string, list: BatchComment[]) {
  if (list.length) localStorage.setItem(KEY(flowId), JSON.stringify(list))
  else localStorage.removeItem(KEY(flowId))
  notifyBatch()
}

export function addComment(flowId: string, comment: Omit<BatchComment, "id">) {
  write(flowId, [...readComments(flowId), { ...comment, id: Math.random().toString(36).slice(2, 10) }])
}

export function removeComment(flowId: string, id: string) {
  write(flowId, readComments(flowId).filter((c) => c.id !== id))
}

export function clearComments(flowId: string) {
  write(flowId, [])
}

export type BatchSketch = { storyId: string; step: number; count: number }

// The screens of the flow with a sketch on them, once per screen.
export function sketchedSteps(flow: Flow, storyOf: (index: number) => string | undefined): BatchSketch[] {
  const seen = new Set<string>()
  return flow.steps.flatMap((_, step) => {
    const storyId = storyOf(step)
    if (!storyId || seen.has(storyId)) return []
    seen.add(storyId)
    const count = readSketch(storyId).length
    return count ? [{ storyId, step, count }] : []
  })
}

function subscribe(l: () => void) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => e.key?.startsWith("stageboard:") && l()
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener("storage", onStorage)
  }
}

/** A number that changes whenever the batch (comments or sketches) changes, to re-read it. */
export function useBatchVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function toAnnotations(
  comments: BatchComment[],
  sketches: BatchSketch[],
  titleOf: (storyId: string) => string,
  viewportOf: (storyId: string) => { width: number; height: number },
): FlowAnnotation[] {
  return [
    ...comments.map((c): FlowAnnotation => ({ storyId: c.storyId, title: c.title, step: c.step, note: c.note, region: c.region, viewport: c.viewport, scroll: c.scroll })),
    ...sketches.map((s): FlowAnnotation => {
      const viewport = viewportOf(s.storyId)
      return { storyId: s.storyId, title: titleOf(s.storyId), step: s.step, viewport, sketch: { ops: readSketch(s.storyId), viewport, scroll: { x: 0, y: 0 } } }
    }),
  ].sort((a, b) => (a.step ?? 0) - (b.step ?? 0))
}
