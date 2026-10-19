---
name: stageboard
description: Set up and grow stageboard in a web app. Use it to write stories with mock data, decide what is a component, a screen or a flow, put every page and page state in Screens, assemble flows, create or edit *.variant.tsx variants, or screenshot a component without running the app. Trigger on "set up stageboard", "add stories", "site map", "flows", "make variants", or a stageboard annotation prompt.
---

# stageboard

stageboard renders an app's components and pages as **stories** with mock data, lists every page as **screens** and strings them into **flows** (shown as desktop, tablet or mobile), and lets people annotate anything and ask agents for **variants**. Most of a project's stageboard code is written by agents, so follow this skill closely.

## Ground rules

- **Look at your work.** After every story or variant, run `npx stageboard shot <story-id> --width 1440 --full --out /tmp/x.png` and open the PNG. A render error is printed; fix it before moving on.
- **No app code changes for mocking.** Mock at the edges (providers, the HTTP client, `next/*` shims), not inside components. If one tiny, behaviour-neutral export is unavoidable (e.g. exporting a React context), make it and list it in your summary.
- **Keep checks targeted.** Typecheck and lint the files you touched; don't run whole-repo suites unless asked.
- **Don't start the app's dev servers.** `stageboard shot` and the stageboard MCP tools work without them.

## Setting up a project (first time)

1. Install: `npm i -D stageboard`. Use the project's package manager.
2. Run `npx stageboard init`, then edit `stageboard.config.ts`:
   ```ts
   import { defineConfig } from "stageboard"
   import { nextPreset } from "stageboard/next" // Next.js only: shims next/image, link, navigation, font, dynamic

   export default defineConfig({
     stories: ["src/**/*.stories.tsx", "stageboard/**/*.stories.tsx"],
     preview: "./stageboard.preview.tsx",
     vite: () => nextPreset({ root: __dirname }), // for plain Vite apps, pass the app's own vite plugins instead
     agent: { provider: "claude" }, // or "codex", "atmos", { provider: "command", command }
   })
   ```
   Tailwind v4 with `@tailwindcss/postcss` works as is. Put `@import` lines before any `@plugin` in global CSS, because Vite drops imports that come later.
3. Write `stageboard.preview.tsx`. It imports the global CSS and exports `decorators` that wrap every story in the app's providers, with mocks where the real ones need a backend or login (see [mocking](references/mocking.md)).
4. Write one story for a leaf component and shoot it. Then write the landing page as a page story and shoot it. Only then go broad.
5. Mount the in-app inspector in development and proxy `/__stageboard/*` to the stageboard server (see [site map](references/site-map.md#in-app-inspector)).
6. Add `.stageboard/` to `.gitignore`. Commit `stageboard.variants.ts`; it's generated, but the app imports it.

## Writing stories

```tsx
import type { Meta, Story } from "stageboard"
import { Button } from "./button"

export default { title: "Primitives/Button", component: Button, args: { children: "Save" } } satisfies Meta<typeof Button>
export const Primary: Story<typeof Button> = {}
export const Disabled: Story<typeof Button> = { args: { disabled: true } }
```

- Ids are `kebab(title)--kebab(export)`; `npx stageboard list` shows them.
- `parameters.layout` is `"centered"` (the default for components), `"padded"` or `"fullscreen"` (the default for pages).
- Every component story renders in its own frame, `parameters.viewport: { width, height }`, shown fitted into a 16:9 tile under Components (default 640×360). Give each new component file a frame just large enough for its stories plus 40px each side, as numbers on the default export, and a smaller one on a story that draws much less (a lone button in a file whose `Variants` story is a long row). Leave room for menus, popovers and dialogs that open. `npx stageboard frames` prints frames that fit; `--write` sets them.
- Use realistic data in the product's language and domain. Never use lorem ipsum.

## Component, screen or flow

Every story is a component or a screen, and flows are made of screens. Decide before you write it:

| | What it is | How to write it | Shows under |
|---|---|---|---|
| **Component** | A reusable piece of UI that makes sense without an address: a button, badge, menu, chart, card, a panel used in several places. No app shell. | No `page`. Title it by where it lives in the design system (`Primitives/Button`, `Tickets/Attachment`), never `Pages/…`. Give it a frame (below). | Components, one row per file, each story in its own frame |
| **Screen** | What a user sees at an address: the app shell with a page, from a route. | `parameters.page = { route, title, group, links }`. Title the file `Pages/<Area>`. | Screens, grouped by `page.group` |
| **Flow** | The screens a user goes through to get one thing done, in order. | Saved with `save_flow` into `stageboard/board.json`. Only screens can be steps. | Flows |

- **Every state of a page is a screen.** A tab, a filter, an empty list, a dialog open, another record, another layout of the same page: each gets its own page story with the same `route` (and `path` if it shows another record) and a `title` that names the state, such as `Kalender: Tag` or `Anfrage: Fax`. Never drop `page` or replace `parameters` (`{ ...page(…), parameters: { layout: "fullscreen" } }`) to keep a state off Screens: the whole page lands under Components, squeezed into a component frame, and no flow can use it.
- **The quick test.** Does it render the app's shell or fill a page at an address? Screen. Does it make sense on its own and appear in several places? Component. A story titled `Pages/…` under Components is always a mistake.
- **Let stageboard see the route.** Write `parameters: { page: { route: "…" } }` in the story, or build it with a helper whose call or body shows `route: "…"` (`page({ route: "/inbox" })`, `{ ...page({ route }), decorators }`), so stageboard can tell a page without loading the file.
- **Check the result.** After adding stories, look at `npx stageboard list`: page stories are marked `page`. Nothing titled `Pages/…` should be missing the mark.

## Screens and flows

To cover a whole app, follow [site-map.md](references/site-map.md): enumerate routes, build a mock backend once, then add page stories area by area and verify each with `shot`. Flows need specific states (a dialog open, a form filled in), and those are screens like any other.

Flows are ordered lists of screens kept in `stageboard/board.json`. Save one with the MCP tool `save_flow` (or `npx stageboard flow save '<json>'`): `{ "flow"?: id, "name", "group", "description", "steps": [{ "storyId", "note"?, "actions"? } | { "pending": "screen you are still building" }] }`. `note` is what happens on the screen. `actions` is what the user does on it, in order, and the viewer plays them with a cursor: `{ "do": "click" | "type" | "press" | "hover" | "scroll" | "wait", "target"?: "visible text, aria-label, placeholder or label (or a CSS selector)", "text"?: "what to type, the key, or ms" }`, e.g. `[{ "do": "click", "target": "Einstellungen" }, { "do": "click", "target": "Telefonmenü bearbeiten" }]`. The last action usually leads to the next step. `list_flows` shows what exists.

To see a whole flow at once, render it into one grid image: `npx stageboard flow shot "<flow id or name>" [--device mobile] [--theme dark]` (or the MCP tool `flow_grid`). It plays each step's actions before capturing it, prints the PNG path and the steps as text, and marks actions that fail (✗ with the reason). Run it before and after changing a flow.

## Variants

To make a component swappable, write `export const Hero = variant("landing.hero", HeroImpl)` (from `stageboard/react`), or wrap JSX in `<Variant id="…">`. Each alternative is one `*.variant.tsx` file next to the original. See [variants.md](references/variants.md) for the file format, how to handle an annotation request, and how to compare variants.

## Tools

| | |
|---|---|
| `npx stageboard shot <id> [--variant id=key] [--width 1440] [--full] [--out file]` | PNG of a story |
| `npx stageboard list [filter]` | story ids |
| `npx stageboard dev` | screens, flows, components and bridge at `/__stageboard/` |
| `npx stageboard flow shot <flow>` | every screen of a flow in one grid image, with notes and actions |
| MCP `stageboard` | `list_stories`, `screenshot`, `flow_grid`, `list_variants`, `compare_variants`, `select_variant`, `complete_job`, `save_flow`, `list_flows` (run with `npx stageboard mcp`) |
