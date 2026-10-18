import type { UserConfig as ViteUserConfig } from "vite"

export type AtmosAgentConfig = {
  provider: "atmos"
  project?: string
  checkout?: string
  device?: string
  harness?: string
  model?: string
  permissionMode?: string
  sameWorktree?: boolean
}

export type ClaudeAgentConfig = {
  provider: "claude"
  background?: boolean
  model?: string
  permissionMode?: string
  extraArgs?: string[]
}

export type CodexAgentConfig = {
  provider: "codex"
  model?: string
  sandbox?: "read-only" | "workspace-write" | "danger-full-access"
  extraArgs?: string[]
}

export type CommandAgentConfig = {
  provider: "command"
  command: string
  // The command only launches the agent elsewhere and returns: exit code 0 leaves the job running until the agent
  // reports with complete_job or `stageboard done`, or the job is cancelled. A non-zero exit still fails it.
  detached?: boolean
}

export type AgentConfig = AtmosAgentConfig | ClaudeAgentConfig | CodexAgentConfig | CommandAgentConfig

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
