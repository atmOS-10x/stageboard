import type { Device, FlowReference } from "../core/protocol"

export type EmbedReference = Omit<FlowReference, "image"> & { image: number }

export type EmbedStep = { id: string; title: string; note?: string; image?: number; reference?: boolean; references: EmbedReference[] }

export type EmbedFlow = { id: string; name: string; description?: string; device: Device; images: string[]; steps: EmbedStep[] }
