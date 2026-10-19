import type { Meta, Story } from "@atmos.build/stageboard"
import { Hero } from "./hero"

export default {
  title: "Marketing/Hero",
  component: Hero,
  parameters: { layout: "fullscreen" },
  args: { title: "Ship calmer software", subtitle: "Everything your team needs, nothing it doesn't.", cta: "Get started" },
} satisfies Meta<typeof Hero>

export const Default: Story<typeof Hero> = {}
export const LongTitle: Story<typeof Hero> = { args: { title: "A much longer headline that wraps onto two lines" } }
