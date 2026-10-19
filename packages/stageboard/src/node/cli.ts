#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { cac } from "cac"
import { measureFrames } from "./frames"
import pc from "picocolors"
import { API_BASE } from "../core/protocol"
import { loadConfig } from "./config"
import { buildIndex } from "./indexer"
import { createStageboardServer, findRunningServer } from "./server"
import { embedFlow } from "./flowembed"
import { flowOutline, shootFlow } from "./flowshot"
import { shoot } from "./shot"
import { writeVariantsModule } from "./variants"

const cli = cac("stageboard")

cli.option("--config <file>", "Path to stageboard.config.ts")

cli
  .command("dev", "Start the catalog, site map and agent bridge")
  .option("--port <port>", "Port", { default: undefined })
  .option("--host <host>", "Host to bind")
  .action(async (opts) => {
    const config = await loadConfig(process.cwd(), opts.config)
    const server = await createStageboardServer(config, { port: opts.port ? Number(opts.port) : undefined, host: opts.host })
    const publicUrl = config.publicUrl ?? process.env.STAGEBOARD_PUBLIC_URL
    console.log()
    console.log(`  ${pc.bold("stageboard")} ${pc.dim("ready")}`)
    console.log(`  ${pc.dim("catalog")}  ${pc.cyan(`${server.url}${API_BASE}/`)}`)
    if (publicUrl) console.log(`  ${pc.dim("public")}   ${pc.cyan(`${publicUrl.replace(/\/$/, "")}${API_BASE}/`)}`)
    console.log(`  ${pc.dim("agent")}    ${config.agent?.provider ?? "claude"}`)
    console.log()
    const stop = async () => {
      await server.close()
      process.exit(0)
    }
    process.on("SIGINT", stop)
    process.on("SIGTERM", stop)
  })

cli
  .command("shot <story>", "Screenshot one story (id, file#Export, or a unique search term)")
  .option("--variant <id=key>", "Select a variant (repeatable)", { type: [String] })
  .option("--width <px>", "Viewport width")
  .option("--height <px>", "Viewport height")
  .option("--full", "Capture the full scroll height")
  .option("--theme <theme>", "light or dark")
  .option("--scale <n>", "Device scale factor")
  .option("--out <file>", "Output PNG path")
  .action(async (story: string, opts) => {
    const config = await loadConfig(process.cwd(), opts.config)
    const result = await shoot(config, {
      story,
      variants: (opts.variant ?? []).filter(Boolean),
      width: opts.width ? Number(opts.width) : undefined,
      height: opts.height ? Number(opts.height) : undefined,
      full: Boolean(opts.full),
      theme: opts.theme,
      scale: opts.scale ? Number(opts.scale) : undefined,
      out: opts.out,
    })
    for (const e of result.consoleErrors.slice(0, 10)) console.error(pc.yellow(`console error: ${e.slice(0, 400)}`))
    console.log(result.file)
    console.error(pc.dim(`${result.story.id} · ${(result.durationMs / 1000).toFixed(1)}s`))
    process.exit(0)
  })

cli
  .command("frames [filter]", "Measure what each component story draws and give it a frame (parameters.viewport) that fits")
  .option("--write", "Write the frames into the story files (otherwise only print them)")
  .action(async (filter: string | undefined, opts) => {
    const config = await loadConfig(process.cwd(), opts.config)
    const result = await measureFrames(config, {
      filter,
      write: Boolean(opts.write),
      onProgress: (done, total) => process.stderr.write(`\r${pc.dim(`measured ${done}/${total}`)}`),
    })
    process.stderr.write("\n")
    for (const plan of result.plans) {
      console.log(`${pc.cyan(plan.file)} ${pc.bold(`${plan.meta.width}×${plan.meta.height}`)}`)
      for (const s of plan.stories) console.log(`  ${s.exportName.padEnd(32)} ${s.frame.width}×${s.frame.height}`)
    }
    for (const s of result.stories.filter((s) => s.error)) console.error(pc.yellow(`could not measure ${s.id}: ${s.error}`))
    for (const s of result.skipped) console.error(pc.dim(`left alone: ${s}`))
    console.log(opts.write ? `\nWrote frames into ${result.written.length} file${result.written.length === 1 ? "" : "s"}. Run your formatter on them.` : "\nDry run: pass --write to set them.")
    process.exit(0)
  })

cli
  .command("list [filter]", "List stories")
  .option("--json", "Output JSON")
  .action(async (filter: string | undefined, opts) => {
    const config = await loadConfig(process.cwd(), opts.config)
    const index = (await buildIndex(config)).filter((s) => !filter || `${s.id} ${s.title} ${s.name}`.toLowerCase().includes(filter.toLowerCase()))
    if (opts.json) {
      console.log(JSON.stringify(index.map(({ absFile: _a, ...s }) => s), null, 2))
      return
    }
    for (const s of index) console.log(`${pc.cyan(s.id.padEnd(48))} ${pc.dim(s.file)}${s.hasPage ? pc.magenta(" page") : ""}`)
  })

cli.command("mcp", "Run the stageboard MCP server on stdio (tools: list_stories, screenshot, flow_grid, list_variants, compare_variants, select_variant, complete_job, save_flow, list_flows, flow_embed)").action(async (opts) => {
  const config = await loadConfig(process.cwd(), opts.config)
  const { runMcpServer } = await import("./mcp")
  await runMcpServer(config)
})

cli
  .command("done <job> [summary]", "Tell the running stageboard that an agent job is finished")
  .option("--failed", "The job could not be done")
  .action(async (job: string, summary: string | undefined, opts) => {
    const config = await loadConfig(process.cwd(), opts.config)
    const base = await findRunningServer(config)
    if (!base) throw new Error("No running stageboard dev server found")
    const res = await fetch(`${base}${API_BASE}/api/jobs/${encodeURIComponent(job)}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary, failed: Boolean(opts.failed) }),
    })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    console.log(`job ${job} marked ${opts.failed ? "failed" : "done"}`)
  })

cli
  .command(
    "flow <action> [arg]",
    "stageboard flow shot <flow>: every screen of a flow in one grid image; stageboard flow embed <flow>: the flow as an HTML fragment for chat hosts; stageboard flow save '<json>': save a flow",
  )
  .option("--device <device>", "flow shot, flow embed: desktop, tablet or mobile", { default: "desktop" })
  .option("--theme <theme>", "flow shot, flow embed: light or dark")
  .option("--cols <n>", "flow shot: screens per row")
  .option("--images <mode>", "flow embed: inline (data URIs) or path (absolute file paths)", { default: "inline" })
  .option("--out <file>", "flow shot: output PNG path; flow embed: output HTML path")
  .action(async (action: string, json: string | undefined, opts) => {
    if (action === "shot") {
      if (!json) throw new Error("usage: stageboard flow shot <flow id or name>")
      if (!["desktop", "tablet", "mobile"].includes(opts.device)) throw new Error("--device must be desktop, tablet or mobile")
      const config = await loadConfig(process.cwd(), opts.config)
      const result = await shootFlow(config, { flow: json, device: opts.device, theme: opts.theme, columns: opts.cols ? Number(opts.cols) : undefined, out: opts.out })
      console.log(result.file)
      console.log()
      console.log(flowOutline(result))
      console.error(pc.dim(`${result.steps.length} screens · ${(result.durationMs / 1000).toFixed(1)}s`))
      process.exit(0)
    }
    if (action === "embed") {
      if (!json) throw new Error("usage: stageboard flow embed <flow id or name>")
      if (!["desktop", "tablet", "mobile"].includes(opts.device)) throw new Error("--device must be desktop, tablet or mobile")
      if (!["inline", "path"].includes(opts.images)) throw new Error("--images must be inline or path")
      const config = await loadConfig(process.cwd(), opts.config)
      const result = await embedFlow(config, { flow: json, device: opts.device, theme: opts.theme, images: opts.images, out: opts.out })
      for (const e of result.errors) console.error(pc.yellow(e))
      console.log(result.file)
      console.error(pc.dim(`${result.steps} screens · ${Math.round(result.bytes / 1024)} KiB`))
      if (result.bytes > 1024 * 1024 && opts.images === "inline") console.error(pc.yellow("Over 1 MiB: hosts that cap fragments may refuse it; --images path keeps images out of the file"))
      process.exit(0)
    }
    if (action !== "save" || !json) throw new Error("usage: stageboard flow shot <flow> | stageboard flow embed <flow> | stageboard flow save '<json>'")
    const config = await loadConfig(process.cwd(), opts.config)
    const base = await findRunningServer(config)
    if (!base) throw new Error("No running stageboard dev server found")
    const body = fs.existsSync(json) ? fs.readFileSync(json, "utf8") : json
    const res = await fetch(`${base}${API_BASE}/api/flows/save`, { method: "POST", headers: { "content-type": "application/json" }, body })
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    const flow = (await res.json()) as { id: string; steps: unknown[] }
    console.log(`saved flow ${flow.id} (${flow.steps.length} steps)`)
  })

cli
  .command("skill [dir]", "Install the stageboard agent skill into .claude/skills and .agents/skills")
  .option("--claude", "Only .claude/skills")
  .option("--codex", "Only .agents/skills")
  .action((dir: string | undefined, opts) => {
    const source = fileURLToPath(new URL("../../skills/stageboard", import.meta.url))
    const root = path.resolve(dir ?? process.cwd())
    const targets = [
      ...(opts.codex ? [] : [path.join(root, ".claude", "skills", "stageboard")]),
      ...(opts.claude ? [] : [path.join(root, ".agents", "skills", "stageboard")]),
    ]
    for (const target of targets) {
      fs.rmSync(target, { recursive: true, force: true })
      fs.cpSync(source, target, { recursive: true })
      console.log(`installed ${path.relative(process.cwd(), target) || target}`)
    }
  })

cli.command("variants", "Regenerate the variants registry file").action(async (opts) => {
  const config = await loadConfig(process.cwd(), opts.config)
  const { changed, variants } = await writeVariantsModule(config)
  console.log(`${variants.length} variant(s) ${changed ? "written to" : "unchanged in"} ${path.relative(process.cwd(), config.variantsFile)}`)
})

cli.command("init", "Create a stageboard.config.ts").action(() => {
  const file = path.resolve("stageboard.config.ts")
  if (fs.existsSync(file)) {
    console.log(`${file} already exists`)
    return
  }
  fs.writeFileSync(
    file,
    `import { defineConfig } from "stageboard"

export default defineConfig({
  stories: ["src/**/*.stories.tsx"],
  preview: "./stageboard.preview.tsx",
  agent: { provider: "claude" },
})
`,
  )
  console.log(`Created ${file}`)
})

cli.help()
cli.version("0.1.0")

try {
  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
} catch (e) {
  console.error(pc.red((e as Error).message))
  process.exit(1)
}
