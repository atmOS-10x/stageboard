import type { Region, Sketch, Upload } from "stageboard"
import type { Viewport } from "./api"

export type ComposerMode = "variants" | "edit"

export type StoredDraft = {
  surfaceKey: string
  region: Region
  viewport: Viewport
  scroll?: { x: number; y: number }
  sketch?: Sketch
  note: string
  attachments: Upload[]
  savedAt: number
}

export type ComposerPrefs = { mode: ComposerMode; count: number }

const DRAFT = "stageboard:draft"
const PREFS = "stageboard:composer"
const MAX_AGE = 24 * 60 * 60 * 1000
const DEBOUNCE_MS = 250

let timer: ReturnType<typeof setTimeout> | undefined

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function readDraft(): StoredDraft | undefined {
  const draft = read<StoredDraft>(DRAFT)
  if (!draft?.surfaceKey || !draft.region || Date.now() - draft.savedAt > MAX_AGE) return undefined
  return draft
}

export function saveDraft(draft: Omit<StoredDraft, "savedAt">) {
  clearTimeout(timer)
  timer = setTimeout(() => localStorage.setItem(DRAFT, JSON.stringify({ ...draft, savedAt: Date.now() })), DEBOUNCE_MS)
}

export function clearDraft() {
  clearTimeout(timer)
  localStorage.removeItem(DRAFT)
}

export function readPrefs(): ComposerPrefs {
  const prefs = read<Partial<ComposerPrefs>>(PREFS)
  return { mode: prefs?.mode === "edit" ? "edit" : "variants", count: Math.min(4, Math.max(1, Number(prefs?.count) || 3)) }
}

export function savePrefs(prefs: ComposerPrefs) {
  localStorage.setItem(PREFS, JSON.stringify(prefs))
}
