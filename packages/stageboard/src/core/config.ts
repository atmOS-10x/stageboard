import type { UserConfig as ViteUserConfig } from "vite"

export type AtmosAgentConfig = {
  provider: "atmos"
  project?: string
  checkout?: string
  device?: string
  harness?: string
  model?: string
  permissionMode?: string
}

export type ClaudeAgentConfig = {
  provider: "claude"
  model?: string
  permissionMode?: string
  extraArgs?: string[]
}

export type CommandAgentConfig = {
  provider: "command"
  command: string
}

export type AgentConfig = AtmosAgentConfig | ClaudeAgentConfig | CommandAgentConfig

export type StageboardConfig = {
  stories: string[]
  preview?: string
  variantsFile?: string
  variantGlobs?: string[]
  ignore?: string[]
  port?: number
  publicUrl?: string
  framework?: "react"
  vite?: ViteUserConfig | (() => ViteUserConfig | Promise<ViteUserConfig>)
  agent?: AgentConfig
  instructions?: string
}

export function defineConfig(config: StageboardConfig): StageboardConfig {
  return config
}
