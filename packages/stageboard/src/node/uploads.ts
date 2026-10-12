import { randomUUID } from "node:crypto"
import fs from "node:fs"
import type { IncomingMessage } from "node:http"
import path from "node:path"
import { API_BASE, type Upload } from "../core/protocol"
import type { ResolvedConfig } from "./config"

const MAX_BYTES = 20 * 1024 * 1024
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
}

export function uploadsDir(config: ResolvedConfig): string {
  const dir = path.join(config.stateDir, "uploads")
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function toUpload(config: ResolvedConfig, file: string, name: string, type: string): Upload {
  const id = path.basename(file)
  return { id, name, type, url: `${API_BASE}/api/uploads/${id}`, path: file }
}

export function writeUpload(config: ResolvedConfig, bytes: Buffer, type: string, name: string): Upload {
  const ext = EXT[type] ?? "bin"
  const file = path.join(uploadsDir(config), `${randomUUID().slice(0, 12)}.${ext}`)
  fs.writeFileSync(file, bytes)
  fs.writeFileSync(`${file}.json`, JSON.stringify({ name, type }))
  return toUpload(config, file, name, type)
}

export function saveUpload(config: ResolvedConfig, req: IncomingMessage): Promise<Upload> {
  const type = String(req.headers["content-type"] ?? "application/octet-stream").split(";")[0]
  if (!type.startsWith("image/")) return Promise.reject(new Error("Only images can be attached"))
  const name = decodeURIComponent(String(req.headers["x-filename"] ?? "image"))
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (c: Buffer) => {
      size += c.length
      if (size > MAX_BYTES) {
        reject(new Error("Image is larger than 20 MB"))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on("end", () => resolve(writeUpload(config, Buffer.concat(chunks), type, name)))
    req.on("error", reject)
  })
}

export function readUpload(config: ResolvedConfig, id: string): Upload | undefined {
  if (!/^[\w.-]+$/.test(id) || id.endsWith(".json")) return undefined
  const file = path.join(uploadsDir(config), id)
  if (!fs.existsSync(file)) return undefined
  let meta = { name: id, type: "application/octet-stream" }
  try {
    meta = JSON.parse(fs.readFileSync(`${file}.json`, "utf8"))
  } catch {}
  return toUpload(config, file, meta.name, meta.type)
}
