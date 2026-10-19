export const API_BASE = "/__stageboard"

export type ComponentFrame = {
  name: string
  source?: { file: string; line?: number; column?: number }
}

export type Region = { x: number; y: number; width: number; height: number }

export type ElementTarget = {
  url: string
  title?: string
  selector: string
  tag: string
  text?: string
  rect: { x: number; y: number; width: number; height: number }
  viewport: { width: number; height: number }
  components: ComponentFrame[]
  variantId?: string
  variantKey?: string
  storyId?: string
  region?: Region
  variantKeys?: Record<string, string>
}

export type RegionDescription = {
  components: ComponentFrame[]
  variantIds: string[]
  selector?: string
  tag?: string
  text?: string
}

export type Upload = { id: string; name: string; type: string; url: string; path: string }

export type ChangeRequestKind = "variants" | "edit" | "adopt" | "page" | "flow"

export type Device = "desktop" | "tablet" | "mobile"

export const DEVICES: Record<Device, { label: string; width: number; height: number }> = {
  desktop: { label: "Desktop", width: 1440, height: 900 },
  tablet: { label: "Tablet", width: 834, height: 1194 },
  mobile: { label: "Mobile", width: 390, height: 844 },
}

// What the user does on a screen, played back in the viewer and by `stageboard flow shot`. target is an element's
// visible text (or aria-label, placeholder, label) or a CSS selector; text is what to type, the key to press, or ms to wait.
export type FlowAction = { do: "click" | "type" | "press" | "hover" | "scroll" | "wait"; target?: string; text?: string }

// note: what is happening on this screen. actions: what the user does on it, in order; the last one usually leads to
// the next step.
export type FlowStep = { id: string; storyId?: string; dream?: string; pending?: string; note?: string; actions?: FlowAction[] }

export const FLOW_ACTIONS: FlowAction["do"][] = ["click", "type", "press", "hover", "scroll", "wait"]

// One action per line: `click Einstellungen`, `type E-Mail-Adresse: name@praxis.de`, `press Enter`, `wait 800`.
export function parseActions(text: string): FlowAction[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): FlowAction => {
      const [verb, ...rest] = line.split(/\s+/)
      const arg = rest.join(" ")
      const kind = (FLOW_ACTIONS as string[]).includes(verb.toLowerCase()) ? (verb.toLowerCase() as FlowAction["do"]) : "click"
      const body = kind === "click" && verb.toLowerCase() !== "click" ? line : arg
      if (kind === "type") {
        const i = body.indexOf(": ")
        return i >= 0 ? { do: "type", target: body.slice(0, i), text: body.slice(i + 2) } : { do: "type", text: body }
      }
      if (kind === "press" || kind === "wait") return { do: kind, text: body }
      return { do: kind, target: body }
    })
}

export function formatAction(a: FlowAction): string {
  if (a.do === "type") return `type ${a.target ? `${a.target}: ` : ""}${a.text ?? ""}`
  if (a.do === "press" || a.do === "wait") return `${a.do} ${a.text ?? ""}`
  return `${a.do} ${a.target ?? ""}`
}

export type Flow = {
  id: string
  name: string
  description?: string
  group?: string
  steps: FlowStep[]
  status: "ready" | "assembling" | "failed"
  jobId?: string
  createdAt: string
}

export type FlowRequest = { name?: string; description?: string; group?: string; steps?: FlowStep[]; assemble?: boolean; suggest?: boolean; attachments?: string[] }

export type Point = { x: number; y: number }

export type SketchOp =
  | { type: "move"; selector: string; components: ComponentFrame[]; text?: string; from: Region; to: Region }
  | { type: "text"; selector: string; components: ComponentFrame[]; before: string; after: string }
  | { type: "block"; rect: Region; color: string; label?: string }
  | { type: "component"; rect: Region; storyId: string; title: string }
  | { type: "stroke"; points: Point[]; color: string; width: number }

export type Sketch = { ops: SketchOp[]; viewport: { width: number; height: number }; scroll: Point }



export type DreamStatus = "rendering" | "done" | "failed"

export type Dream = {
  id: string
  name?: string
  prompt: string
  parent?: string
  position?: Point
  status: DreamStatus
  jobId?: string
  storyId?: string
  createdAt: string
}

export type DreamRequest = { name?: string; prompt: string; parent?: string; parentUrl?: string; position?: Point; attachments?: string[]; flow?: { id: string; index: number } }

// One screen's part of a batch of annotations on a flow: a comment on a region, the user's sketch on that screen, or both.
export type FlowAnnotation = {
  storyId: string
  title?: string
  step?: number
  note?: string
  region?: Region
  viewport: { width: number; height: number }
  scroll?: Point
  sketch?: Sketch
}

// The page area a sketch touches, or the fallback when it has no ops with a position.
export function sketchBounds(ops: SketchOp[], fallback: Region): Region {
  const boxes: Region[] = []
  for (const op of ops) {
    if (op.type === "move") boxes.push(op.from, op.to)
    else if (op.type === "block" || op.type === "component") boxes.push(op.rect)
    else if (op.type === "stroke" && op.points.length) {
      const xs = op.points.map((p) => p.x)
      const ys = op.points.map((p) => p.y)
      boxes.push({ x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) || 1, height: Math.max(...ys) - Math.min(...ys) || 1 })
    }
  }
  if (!boxes.length) return fallback
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(Math.max(...boxes.map((b) => b.x + b.width)) - x)),
    height: Math.max(1, Math.round(Math.max(...boxes.map((b) => b.y + b.height)) - y)),
  }
}

export type ChangeRequest = {
  kind: ChangeRequestKind
  note: string
  count?: number
  target: ElementTarget
  adoptKey?: string
  attachments?: string[]
  showVariants?: boolean
  sketch?: Sketch
  dream?: Dream
  flow?: Flow
  /** A note on a whole component: every story of it, in the order Components shows them. */
  component?: ComponentGroup
  annotations?: FlowAnnotation[]
}

export type ComponentGroup = { title: string; stories: { id: string; name: string }[] }

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled"

export type Job = {
  id: string
  kind: ChangeRequestKind
  status: JobStatus
  note: string
  count: number
  variantId?: string
  target: ElementTarget
  provider: string
  externalId?: string
  externalUrl?: string
  createdAt: string
  updatedAt: string
  producedFiles: string[]
  log: string[]
  error?: string
  summary?: string
  attachments?: Upload[]
  selectionImage?: string
  sketchImage?: string
  images?: { label: string; path: string }[]
  dream?: string
  flow?: string
}

export type VariantMeta = {
  of: string
  label?: string
  description?: string
  job?: string
}

export type VariantFile = {
  key: string
  of: string
  label: string
  description?: string
  file: string
  job?: string
}

export type BridgeState = {
  version: number
  selections: Record<string, string>
  jobs: Job[]
  variants: VariantFile[]
  dreams: Dream[]
  flows: Flow[]
}

export const ORIGINAL = "original"

export function variantKeyFromFile(file: string): string {
  const base = file.split("/").pop() ?? file
  return base.replace(/\.variant\.[cm]?[jt]sx?$/, "")
}
