export const API_BASE = "/__stageboard"

export type ComponentFrame = {
  name: string
  source?: { file: string; line?: number; column?: number }
}

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
}

export type ChangeRequestKind = "variants" | "edit" | "adopt"

export type ChangeRequest = {
  kind: ChangeRequestKind
  note: string
  count?: number
  target: ElementTarget
  adoptKey?: string
  screenshot?: string
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
}

export const ORIGINAL = "original"

export function variantKeyFromFile(file: string): string {
  const base = file.split("/").pop() ?? file
  return base.replace(/\.variant\.[cm]?[jt]sx?$/, "")
}
