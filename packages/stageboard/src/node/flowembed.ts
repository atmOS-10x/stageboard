import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { Device } from "../core/protocol"
import type { EmbedFlow } from "../embed/data"
import { embedCss } from "../embed/styles"
import type { ResolvedConfig } from "./config"
import { captureFlow } from "./flowshot"
import { IMAGE_TYPE, referenceFile } from "./references"

export type FlowEmbedOptions = { flow: string; device?: Device; theme?: "light" | "dark"; images?: "inline" | "path"; out?: string }

export type FlowEmbedResult = { file: string; bytes: number; steps: number; errors: string[] }

function embedBundle(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  while (!fs.existsSync(path.join(dir, "package.json"))) dir = path.dirname(dir)
  const file = path.join(dir, "dist", "embed", "flow.global.js")
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}; build stageboard first`)
  return fs.readFileSync(file, "utf8")
}

const inlineScript = (source: string) => source.replace(/<\/(script)/gi, "<\\/$1")

export async function embedFlow(config: ResolvedConfig, options: FlowEmbedOptions): Promise<FlowEmbedResult> {
  const device = options.device ?? "desktop"
  const { flow, steps } = await captureFlow(config, { flow: options.flow, device, theme: options.theme, scale: device === "desktop" ? 1 : 2, type: "jpeg", play: false })
  const dir = path.join(config.stateDir, "exports", `flow-${flow.id}`)
  fs.mkdirSync(dir, { recursive: true })
  const images: string[] = []
  const add = (file: string) => {
    const src = options.images === "path" ? file : `data:${IMAGE_TYPE[path.extname(file).toLowerCase()] ?? "image/jpeg"};base64,${fs.readFileSync(file).toString("base64")}`
    const known = images.indexOf(src)
    if (known >= 0) return known
    images.push(src)
    return images.length - 1
  }
  const errors: string[] = []
  const data: EmbedFlow = { id: flow.id, name: flow.name, description: flow.description, device, images, steps: [] }
  for (const [i, captured] of steps.entries()) {
    const step = flow.steps[i]
    const references = []
    for (const r of step.references ?? []) {
      try {
        references.push({ ...r, image: add(await referenceFile(config, r.image)) })
      } catch (e) {
        errors.push(`step ${i + 1}: ${(e as Error).message}`)
      }
    }
    let image: number | undefined
    if (captured.image) {
      const file = path.join(dir, `${i + 1}-${captured.storyId ?? step.id}.jpg`)
      fs.writeFileSync(file, captured.image)
      image = add(file)
    } else if (captured.error && captured.storyId) errors.push(`step ${i + 1}: ${captured.error}`)
    data.steps.push({
      id: step.id,
      title: captured.title,
      note: step.note,
      image: image ?? references[0]?.image,
      reference: image === undefined && references.length > 0,
      references,
    })
  }
  const rootId = `sb-flow-${flow.id.replace(/[^\w-]/g, "")}`
  const html = `<div id="${rootId}" class="sbu-embed">
<style>
${embedCss(rootId)}
</style>
<script type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script>${inlineScript(embedBundle())}
StageboardFlowEmbed.mountFlowEmbed(document.getElementById(${JSON.stringify(rootId)}))</script>
</div>
`
  const file = path.resolve(options.out ?? path.join(config.stateDir, "exports", `flow-${flow.id}.html`))
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, html)
  return { file, bytes: Buffer.byteLength(html), steps: data.steps.length, errors }
}
