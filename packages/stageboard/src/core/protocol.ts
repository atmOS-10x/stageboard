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

export type FlowStep = { id: string; storyId?: string; dream?: string; pending?: string; note?: string }

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
}

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
