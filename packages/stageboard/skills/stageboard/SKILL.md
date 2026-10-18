---
name: stageboard
description: Set up and grow stageboard in a web app. Use it to write stories with mock data, put every page on the site map, create or edit *.variant.tsx variants, or screenshot a component without running the app. Trigger on "set up stageboard", "add stories", "site map", "make variants", or a stageboard annotation prompt.
---

# stageboard

stageboard renders an app's components and pages as **stories** with mock data, lays every page out on a **site map**, and lets people annotate anything and ask agents for **variants**. Most of a project's stageboard code is written by agents, so follow this skill closely.

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
     preview: "./stageboard/preview.tsx",
     vite: () => nextPreset({ root: __dirname }), // for plain Vite apps, pass the app's own vite plugins instead
     agent: { provider: "claude" }, // or "codex", "atmos", { provider: "command", command }
   })
   ```
   Tailwind v4 with `@tailwindcss/postcss` works as is. Put `@import` lines before any `@plugin` in global CSS, because Vite drops imports that come later.
3. Write `stageboard/preview.tsx`. It imports the global CSS and exports `decorators` that wrap every story in the app's providers, with mocks where the real ones need a backend or login (see [mocking](references/mocking.md)).
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
- `parameters.layout` is `"centered"` (the default for components), `"padded"` or `"fullscreen"` (the default for pages). Use `parameters.viewport.width` for wide components.
- Use realistic data in the product's language and domain. Never use lorem ipsum.

## Site map

Pages are stories with `parameters.page = { route, title, group, links }`. To cover a whole app, follow [site-map.md](references/site-map.md): enumerate routes, build a mock backend once, then add page stories area by area and verify each with `shot`.

## Variants

To make a component swappable, write `export const Hero = variant("landing.hero", HeroImpl)` (from `stageboard/react`), or wrap JSX in `<Variant id="…">`. Each alternative is one `*.variant.tsx` file next to the original. See [variants.md](references/variants.md) for the file format, how to handle an annotation request, and how to compare variants.

## Tools

| | |
|---|---|
| `npx stageboard shot <id> [--variant id=key] [--width 1440] [--full] [--out file]` | PNG of a story |
| `npx stageboard list [filter]` | story ids |
| `npx stageboard dev` | catalog, site map and bridge at `/__stageboard/` |
| MCP `stageboard` | `list_stories`, `screenshot`, `list_variants`, `compare_variants`, `select_variant`, `complete_job` (run with `npx stageboard mcp`) |
