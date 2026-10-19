import type { Decorator, Meta, StageParameters, Story, StoryEntry } from "@atmos.build/stageboard"

export type ClientEntry = StoryEntry & { hasPage?: boolean }

export type Loaders = Record<string, () => Promise<Record<string, unknown>>>

export type PreviewModule = {
  decorators?: Decorator[]
  parameters?: StageParameters
  [key: string]: unknown
}

export type StoryModule = {
  default?: Meta
  [exportName: string]: unknown
}

export type ResolvedStory = {
  entry: ClientEntry
  meta: Meta
  story: Story
  parameters: StageParameters
}

export function resolveStory(entry: ClientEntry, mod: StoryModule, preview?: PreviewModule): ResolvedStory {
  const meta = (mod.default ?? {}) as Meta
  const raw = mod[entry.exportName]
  const story: Story = typeof raw === "function" ? { render: raw as Story["render"] } : ((raw ?? {}) as Story)
  const parameters: StageParameters = {
    ...(preview?.parameters ?? {}),
    ...(meta.parameters ?? {}),
    ...(story.parameters ?? {}),
  }
  return { entry, meta, story, parameters }
}
