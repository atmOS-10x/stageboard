# stageboard

Every component and page of your app on one board. Render anything in isolation with mock data,
see your whole product as a live site map, point at any element and ask an agent for variants,
then pick the one you like. Variants show up live while the agent works.

- **Stories**: a small, Storybook-compatible story format (`*.stories.tsx`). Pages are stories with
  `parameters.page = { route, links }`, which places them on the site map with UX-flow edges.
- **`stageboard shot <story>`**: a headless screenshot of one story, with no app or backend running.
  Agents use it to look at their own work.
- **Variants**: wrap any component with `variant("landing.hero", Hero)`, or any JSX with
  `<Variant id="landing.hero">…</Variant>`. Each alternative is a single `*.variant.tsx` file, and a
  generated registry picks it up, so many agents can add variants in parallel without conflicts.
  Production renders the original with no overhead.
- **Inspector**: `<StageboardDevtools />` adds a bubble to your real app. You pick an element, see
  its component chain and source file, switch between variants, or request a change.
- **Bridge + agents**: change requests become jobs that run an agent (atmOS, Claude Code, or any
  CLI). While a job runs, the targeted component animates and "Generating…" slots fill in as
  variant files land.

The core is framework-agnostic. The first renderer is React (it works with Next.js via a preset
that shims `next/*`).

## Quick start

```bash
npm i -D stageboard
npx stageboard init
```

```ts
// stageboard.config.ts
import { defineConfig } from "stageboard"

export default defineConfig({
  stories: ["src/**/*.stories.tsx"],
  preview: "./stageboard.preview.tsx", // global CSS + decorators (providers, mocks)
  agent: { provider: "claude" },       // or { provider: "atmos", project: "…" } or { provider: "command", command: "…" }
})
```

```tsx
// hero.stories.tsx
import type { Meta, Story } from "stageboard"
import { Hero } from "./hero"

export default { title: "Marketing/Hero", component: Hero, args: { title: "Hello" } } satisfies Meta<typeof Hero>
export const Default: Story<typeof Hero> = {}
export const Page: Story = { render: () => <HomePage />, parameters: { page: { route: "/", links: ["/pricing"] } } }
```

```bash
npx stageboard dev                      # catalog + site map + bridge at http://localhost:6060/__stageboard/
npx stageboard shot marketing-hero--default --width 1440 --out hero.png
npx stageboard shot marketing-hero--default --variant landing.hero=hero.editorial
npx stageboard list
```

### In your running app

```tsx
// dev only, e.g. loaded with next/dynamic from the root layout
import { StageboardDevtools } from "stageboard/react"
import "./stageboard.variants" // generated registry

export default function Dev() {
  return <StageboardDevtools base="/__stageboard" />
}
```

Proxy `/__stageboard/api/*` from your dev server to the stageboard server so the bubble can reach
the bridge.

### Variant files

```tsx
// hero.editorial.variant.tsx
export const variant = { of: "landing.hero", label: "Editorial", description: "Serif headline, no gradient." }
export default function HeroEditorial(props: HeroProps) { /* … */ }
```

## Agent protocol

A change request carries the selected element: its URL, CSS selector, component chain with
source locations, rect, viewport, the variant boundary and the story id. It is sent to the agent as
a prompt that ends with a `Page context (JSON):` block, which is the same convention the atmOS
browser extension uses. The prompt tells the agent the variant file format and how to screenshot
its results with `stageboard shot`.

## Status

Early. The API will move.
