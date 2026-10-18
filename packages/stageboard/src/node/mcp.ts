import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { API_BASE, ORIGINAL, type BridgeState } from "../core/protocol"
import type { ResolvedConfig } from "./config"
import { buildIndex } from "./indexer"
import { createStageboardServer, findRunningServer } from "./server"

type Image = { type: "image"; data: string; mimeType: string }
type Text = { type: "text"; text: string }

export async function runMcpServer(config: ResolvedConfig) {
  let base: string | undefined
  let ephemeral: Awaited<ReturnType<typeof createStageboardServer>> | undefined

  async function server(): Promise<string> {
    if (base) {
      const alive = await fetch(`${base}${API_BASE}/api/state`, { signal: AbortSignal.timeout(1500) }).then((r) => r.ok).catch(() => false)
      if (alive) return base
    }
    base = await findRunningServer(config)
    if (!base) {
      ephemeral ??= await createStageboardServer(config, { port: 0, watch: false, quiet: true, host: "127.0.0.1" })
      base = ephemeral.url
    }
    return base
  }

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${await server()}${API_BASE}/api${path}`, init)
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    return (await res.json()) as T
  }

  async function shot(story: string, params: Record<string, string | number | boolean | undefined>): Promise<Image> {
    const q = new URLSearchParams({ story })
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== false) q.set(k, String(v === true ? 1 : v))
    const res = await fetch(`${await server()}${API_BASE}/api/shot?${q}`)
    if (!res.ok) throw new Error(`screenshot failed: ${res.status} ${await res.text()}`)
    return { type: "image", data: Buffer.from(await res.arrayBuffer()).toString("base64"), mimeType: "image/png" }
  }

  const variantParam = (variants?: Record<string, string>) =>
    variants && Object.keys(variants).length ? Object.entries(variants).map(([id, key]) => `${id}:${key}`).join(",") : undefined

  const mcp = new McpServer({ name: "stageboard", version: "0.1.0" })

  mcp.registerTool(
    "list_stories",
    {
      description: "List the stories (components and pages) stageboard can render, with ids to pass to screenshot.",
      inputSchema: { filter: z.string().optional().describe("Case-insensitive text to match against id, title or name") },
    },
    async ({ filter }) => {
      const index = await buildIndex(config)
      const f = filter?.toLowerCase()
      const rows = index
        .filter((s) => !f || `${s.id} ${s.title} ${s.name}`.toLowerCase().includes(f))
        .map((s) => `${s.id}\t${s.title} / ${s.name}\t${s.file}${s.hasPage ? "\tpage" : ""}`)
      return { content: [{ type: "text", text: rows.join("\n") || "No stories match." } satisfies Text] }
    },
  )

  mcp.registerTool(
    "screenshot",
    {
      description:
        "Render one story in a headless browser and return a PNG. Optionally select variants, set the viewport, capture the full page, or clip to a region (story viewport pixels).",
      inputSchema: {
        story: z.string().describe("Story id from list_stories"),
        variants: z.record(z.string(), z.string()).optional().describe('Variant selections, e.g. {"landing.hero": "hero.ruhig2"}'),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        full: z.boolean().optional().describe("Capture the full scroll height"),
        region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).optional(),
      },
    },
    async ({ story, variants, width, height, full, region }) => {
      const image = await shot(story, {
        variant: variantParam(variants),
        w: width,
        h: height,
        full,
        x: region?.x,
        y: region?.y,
        rw: region?.width,
        rh: region?.height,
      })
      return { content: [image] }
    },
  )

  mcp.registerTool(
    "list_variants",
    {
      description: "List variant boundaries, their variant files (key, label, description, file) and which one is selected.",
      inputSchema: { id: z.string().optional().describe("Only this variant boundary id, e.g. landing.hero") },
    },
    async ({ id }) => {
      const state = await api<BridgeState>("/state")
      const ids = [...new Set(state.variants.map((v) => v.of))].filter((v) => !id || v === id).sort()
      const out = ids.map((of) => ({
        id: of,
        selected: state.selections[of] ?? ORIGINAL,
        variants: state.variants.filter((v) => v.of === of).map(({ key, label, description, file }) => ({ key, label, description, file })),
      }))
      return { content: [{ type: "text", text: JSON.stringify(out, null, 2) } satisfies Text] }
    },
  )

  mcp.registerTool(
    "compare_variants",
    {
      description:
        "Screenshot a story once per variant of one boundary (original first) so you can compare them side by side. Defaults to a story that renders the boundary.",
      inputSchema: {
        id: z.string().describe("Variant boundary id, e.g. landing.hero"),
        story: z.string().optional(),
        keys: z.array(z.string()).optional().describe("Only these variant keys (\"original\" allowed)"),
        width: z.number().int().optional(),
        full: z.boolean().optional(),
      },
    },
    async ({ id, story, keys, width, full }) => {
      const state = await api<BridgeState>("/state")
      const used = await api<Record<string, string[]>>("/used-variants")
      const target = story ?? Object.entries(used).find(([, ids]) => ids.includes(id))?.[0]
      if (!target) throw new Error(`No story renders ${id} yet; pass story explicitly (see list_stories).`)
      const all = [ORIGINAL, ...state.variants.filter((v) => v.of === id).map((v) => v.key)]
      const chosen = keys?.length ? all.filter((k) => keys.includes(k)) : all
      const content: (Text | Image)[] = []
      for (const key of chosen) {
        const label = key === ORIGINAL ? "Original" : (state.variants.find((v) => v.key === key && v.of === id)?.label ?? key)
        content.push({ type: "text", text: `${label} (${key})` })
        content.push(await shot(target, { variant: `${id}:${key}`, w: width, full }))
      }
      return { content }
    },
  )

  mcp.registerTool(
    "select_variant",
    {
      description: "Select which variant the user sees for a boundary (\"original\" for the committed one). Updates the live app, catalog and site map.",
      inputSchema: { id: z.string(), key: z.string() },
    },
    async ({ id, key }) => {
      await api("/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, key }) })
      return { content: [{ type: "text", text: `Selected ${key} for ${id}.` } satisfies Text] }
    },
  )

  mcp.registerTool(
    "complete_job",
    {
      description:
        "Tell stageboard you have finished a job it gave you (the job id is in your instructions). Call it once, as your very last step, so the user's board stops showing the job as running.",
      inputSchema: {
        job: z.string().describe("Job id from your instructions"),
        summary: z.string().describe("One or two sentences on what you changed"),
        failed: z.boolean().optional().describe("True if you could not do what was asked"),
      },
    },
    async ({ job, summary, failed }) => {
      await api(`/jobs/${encodeURIComponent(job)}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary, failed }) })
      return { content: [{ type: "text", text: `Job ${job} marked ${failed ? "failed" : "done"}.` } satisfies Text] }
    },
  )

  const transport = new StdioServerTransport()
  await mcp.connect(transport)
  const shutdown = async () => {
    await ephemeral?.close()
    process.exit(0)
  }
  process.stdin.on("close", shutdown)
  process.on("SIGTERM", shutdown)
}
