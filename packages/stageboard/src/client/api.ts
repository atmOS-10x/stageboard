import type { Region, RegionDescription, Upload } from "stageboard"

export type Viewport = { width: number; height: number }

export type VariantRef = { id: string; key: string; label?: string }

export function variantParam(variants: VariantRef[]): string {
  return variants.map((v) => `${v.id}:${v.key}`).join(",")
}

export function withQuery(url: string, params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&")
  if (!q) return url
  return `${url}${url.includes("?") ? "&" : "?"}${q}`
}

export async function uploadImage(base: string, file: File): Promise<Upload> {
  const res = await fetch(`${base}/api/uploads`, {
    method: "POST",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream", "x-filename": encodeURIComponent(file.name || "image") },
  })
  if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`)
  return (await res.json()) as Upload
}

export async function describeOnServer(
  base: string,
  storyId: string,
  region: Region,
  viewport: Viewport,
  variants: VariantRef[],
  signal: AbortSignal,
): Promise<RegionDescription> {
  const url = withQuery(`${base}/api/describe`, {
    story: storyId,
    x: Math.round(region.x),
    y: Math.round(region.y),
    w: Math.round(region.width),
    h: Math.round(region.height),
    vw: Math.round(viewport.width),
    vh: Math.round(viewport.height),
    variant: variantParam(variants) || undefined,
  })
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`describe ${res.status}`)
  return (await res.json()) as RegionDescription
}

type DescribeFn = (rect: Region) => RegionDescription

export function describeInFrame(frame: HTMLIFrameElement | null | undefined, region: Region): RegionDescription | undefined {
  try {
    const win = frame?.contentWindow as (Window & { __stageboard_describeRegion?: DescribeFn; scrollX: number; scrollY: number }) | null
    const fn = win?.__stageboard_describeRegion
    if (!win || !fn) return undefined
    return fn({ ...region, x: region.x - win.scrollX, y: region.y - win.scrollY })
  } catch {
    return undefined
  }
}

export function frameScroll(frame: HTMLIFrameElement | null | undefined): { x: number; y: number } {
  try {
    const win = frame?.contentWindow
    return { x: win?.scrollX ?? 0, y: win?.scrollY ?? 0 }
  } catch {
    return { x: 0, y: 0 }
  }
}

export function uploadUrl(base: string, path: string): string {
  return `${base}/api/uploads/${path.split("/").pop()}`
}

export async function fetchUsedVariants(base: string): Promise<Record<string, string[]>> {
  try {
    const res = await fetch(`${base}/api/used-variants`)
    return res.ok ? ((await res.json()) as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

export function storyUrl(frameUrl: string): string {
  const url = new URL(frameUrl, location.href)
  url.searchParams.delete("sb-embed")
  return url.href
}
