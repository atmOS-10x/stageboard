import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { isRemoteImage, type Flow } from "../core/protocol"
import type { ResolvedConfig } from "./config"

const MAX_REFERENCE_BYTES = 10 * 1024 * 1024
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/avif": "avif", "image/svg+xml": "svg",
}
export const IMAGE_TYPE: Record<string, string> = Object.fromEntries(Object.entries(IMAGE_EXT).map(([type, ext]) => [`.${ext}`, type]))
IMAGE_TYPE[".jpeg"] = "image/jpeg"

const sha1 = (value: string) => createHash("sha1").update(value).digest("hex")

async function readCapped(res: Response, url: string): Promise<Buffer> {
  if (Number(res.headers.get("content-length") ?? 0) > MAX_REFERENCE_BYTES) throw new Error(`${url} is larger than 10 MiB`)
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = res.body!.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_REFERENCE_BYTES) {
      await reader.cancel()
      throw new Error(`${url} is larger than 10 MiB`)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

async function download(config: ResolvedConfig, url: string): Promise<string> {
  const dir = path.join(config.stateDir, "references")
  const hash = sha1(url)
  const cached = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => f.startsWith(`${hash}.`) && !f.endsWith(".tmp")) : undefined
  if (cached) return path.join(dir, cached)
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "follow" })
  if (!res.ok) throw new Error(`${url} returned ${res.status}`)
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  const ext = IMAGE_EXT[type]
  if (!ext) throw new Error(`${url} is not an image (content-type ${type || "missing"})`)
  const body = await readCapped(res, url)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${hash}.${ext}`)
  fs.writeFileSync(`${file}.tmp`, body)
  fs.renameSync(`${file}.tmp`, file)
  return file
}

export async function referenceFile(config: ResolvedConfig, image: string): Promise<string> {
  if (isRemoteImage(image)) return download(config, image)
  const file = path.resolve(config.root, image)
  if (!file.startsWith(config.root + path.sep)) throw new Error(`reference image is outside the project: ${image}`)
  if (!fs.existsSync(file)) throw new Error(`reference image not found: ${image}`)
  return file
}

export function isReferenced(flows: Flow[], image: string): boolean {
  return flows.some((f) => f.steps.some((s) => s.references?.some((r) => r.image === image)))
}
