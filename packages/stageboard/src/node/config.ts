import fs from "node:fs"
import path from "node:path"
import { createJiti } from "jiti"
import type { StageboardConfig } from "../core/config"

const CONFIG_NAMES = ["stageboard.config.ts", "stageboard.config.mts", "stageboard.config.js", "stageboard.config.mjs"]

export type ResolvedConfig = StageboardConfig & {
  root: string
  configFile: string
  variantsFile: string
  stateDir: string
  port: number
}

export function findConfigFile(from = process.cwd()): string | undefined {
  let dir = path.resolve(from)
  while (true) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(dir, name)
      if (fs.existsSync(candidate)) return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export async function loadConfig(from = process.cwd(), explicit?: string): Promise<ResolvedConfig> {
  const configFile = explicit ? path.resolve(explicit) : findConfigFile(from)
  if (!configFile) {
    throw new Error(`No stageboard.config.ts found from ${from}. Run \`stageboard init\` to create one.`)
  }
  const jiti = createJiti(import.meta.url, { interopDefault: true, moduleCache: false })
  const loaded = (await jiti.import(configFile, { default: true })) as StageboardConfig
  const root = path.dirname(configFile)
  return {
    ...loaded,
    root,
    configFile,
    variantsFile: path.resolve(root, loaded.variantsFile ?? "stageboard.variants.ts"),
    stateDir: path.join(root, ".stageboard"),
    port: loaded.port ?? Number(process.env.STAGEBOARD_PORT ?? 6060),
  }
}
