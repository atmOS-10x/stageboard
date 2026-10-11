import { useSyncExternalStore, type ComponentType } from "react"
import {
  API_BASE,
  ORIGINAL,
  variantKeyFromFile,
  type BridgeState,
  type ChangeRequest,
  type Job,
  type VariantFile,
  type VariantMeta,
} from "../core/protocol"

export type VariantModule = {
  default?: ComponentType<any>
  variant?: VariantMeta
  [key: string]: unknown
}

export type RegisteredVariant = {
  key: string
  of: string
  label: string
  description?: string
  file: string
  job?: string
  component: ComponentType<any>
}

type Snapshot = {
  selections: Record<string, string>
  overrides: Record<string, string>
  jobs: Job[]
  serverVariants: VariantFile[]
  registry: Record<string, RegisteredVariant[]>
  connected: boolean
  version: number
}

const STORAGE_KEY = "stageboard:selections"
const GLOBAL_KEY = "__stageboard_store__"

type Store = {
  snapshot: Snapshot
  listeners: Set<() => void>
  base: string
  pollTimer?: ReturnType<typeof setTimeout>
  polling: boolean
}

function createStore(): Store {
  return {
    snapshot: {
      selections: readLocalSelections(),
      overrides: readUrlOverrides(),
      jobs: [],
      serverVariants: [],
      registry: {},
      connected: false,
      version: 0,
    },
    listeners: new Set(),
    base: API_BASE,
    polling: false,
  }
}

function store(): Store {
  const g = globalThis as unknown as Record<string, Store | undefined>
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = createStore()
  return g[GLOBAL_KEY]!
}

function emit(next: Partial<Snapshot>) {
  const s = store()
  s.snapshot = { ...s.snapshot, ...next }
  s.listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  const s = store()
  s.listeners.add(listener)
  return () => s.listeners.delete(listener)
}

export function useStageboard<T>(select: (s: Snapshot) => T): T {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return select(snapshot)
}

export function getSnapshot(): Snapshot {
  return store().snapshot
}

function readLocalSelections(): Record<string, string> {
  if (typeof localStorage === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function writeLocalSelections(selections: Record<string, string>) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selections))
}

function readUrlOverrides(): Record<string, string> {
  if (typeof location === "undefined") return {}
  const params = new URLSearchParams(location.search)
  const out: Record<string, string> = {}
  for (const raw of params.getAll("sb-variant")) {
    for (const pair of raw.split(",")) {
      const [id, key] = pair.split(":")
      if (id && key) out[id] = key
    }
  }
  return out
}

export function setVariantOverrides(overrides: Record<string, string>) {
  emit({ overrides: { ...overrides, ...readUrlOverrides() } })
}

export function registerVariants(entries: { file: string; module: VariantModule }[]) {
  const registry: Record<string, RegisteredVariant[]> = {}
  for (const { file, module } of entries) {
    const meta = module.variant
    const component = module.default
    if (!meta?.of || !component) continue
    const key = variantKeyFromFile(file)
    ;(registry[meta.of] ??= []).push({
      key,
      of: meta.of,
      label: meta.label ?? key,
      description: meta.description,
      file,
      job: meta.job,
      component,
    })
  }
  for (const list of Object.values(registry)) list.sort((a, b) => a.key.localeCompare(b.key))
  emit({ registry })
}

export function selectedKey(snapshot: Snapshot, id: string): string {
  return snapshot.overrides[id] ?? snapshot.selections[id] ?? ORIGINAL
}

export function useSelectedVariant(id: string): RegisteredVariant | undefined {
  return useStageboard((s) => {
    const key = selectedKey(s, id)
    if (key === ORIGINAL) return undefined
    return s.registry[id]?.find((v) => v.key === key)
  })
}

export function setBridgeBase(base: string) {
  store().base = base.replace(/\/$/, "")
}

export function bridgeBase(): string {
  return store().base
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${store().base}/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

export async function selectVariant(id: string, key: string) {
  const { selections, overrides } = getSnapshot()
  const nextSelections = { ...selections, [id]: key }
  const nextOverrides = { ...overrides }
  delete nextOverrides[id]
  writeLocalSelections(nextSelections)
  emit({ selections: nextSelections, overrides: nextOverrides })
  try {
    await request("/select", { method: "POST", body: JSON.stringify({ id, key }) })
  } catch {
    emit({ connected: false })
  }
}

export async function submitChangeRequest(change: ChangeRequest): Promise<Job> {
  const job = await request<Job>("/requests", { method: "POST", body: JSON.stringify(change) })
  emit({ jobs: [...getSnapshot().jobs.filter((j) => j.id !== job.id), job] })
  schedulePoll(300)
  return job
}

export async function cancelJob(id: string) {
  await request(`/jobs/${id}/cancel`, { method: "POST" })
  schedulePoll(100)
}

function applyState(state: BridgeState) {
  const prev = getSnapshot()
  if (prev.connected && prev.version === state.version) return
  writeLocalSelections(state.selections)
  emit({
    selections: state.selections,
    jobs: state.jobs,
    serverVariants: state.variants,
    connected: true,
    version: state.version,
  })
}

async function poll() {
  try {
    applyState(await request<BridgeState>("/state"))
  } catch {
    if (getSnapshot().connected) emit({ connected: false })
  }
  const s = getSnapshot()
  const active = s.jobs.some((j) => j.status === "queued" || j.status === "running")
  schedulePoll(!s.connected ? 5000 : active ? 800 : 2000)
}

function schedulePoll(delay: number) {
  const s = store()
  if (!s.polling) return
  if (s.pollTimer) clearTimeout(s.pollTimer)
  s.pollTimer = setTimeout(poll, delay)
}

export function startBridge(base?: string) {
  const s = store()
  if (base) setBridgeBase(base)
  if (s.polling || typeof window === "undefined") return
  s.polling = true
  schedulePoll(0)
}

export function isActiveJob(job: Job): boolean {
  return job.status === "queued" || job.status === "running"
}
