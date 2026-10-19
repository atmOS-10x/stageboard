# Writing the stageboard docs

What the docs must do, and how pages are written. Read this before editing anything in `src/content/docs`.

## Required

- **One job per page.** Introduction, quick start, configuration, one guide per feature (stories, screens and pages, flows, annotate, variants, agents, Next.js, devtools in your app), and reference pages (CLI, config, MCP tools, React API).
- **True to the code.** Every option, flag, default, file name and tool name is checked against `packages/stageboard/src` before it is written. If the code and the README disagree, the code wins. Nothing is documented that doesn't exist.
- **Readable by agents.** The site publishes `/llms.txt`, `/llms-full.txt` and every page as Markdown at `/<page>.md`. So every page must stand on its own: say what the thing is in the first sentence, don't lean on images or on "as shown above", and give complete, copyable code.
- **Concise.** Short sentences, no marketing, no filler. A guide is usually 60–150 lines of MDX. Prefer one good example over three.

## Style

The site is a Fumadocs (Next.js) app. Pages are MDX in `src/content/docs`; the sidebar comes from `meta.json` files.

- Frontmatter: `title` (sentence case) and a one-line `description` that says what the reader can do after reading. Nothing else.
- Open with one or two sentences: what it is and when to use it. Then the smallest working example. Then details.
- Code blocks always have a language and, when it's a file, a title: ```` ```tsx title="src/hero.stories.tsx" ````. Use `// [!code ++]`, `// [!code --]` or `// [!code highlight]` markers only when they help.
- Commands use `npx stageboard …`. Install steps use an ```` ```npm ```` block with the npm command (`npm i -D @atmos.build/stageboard`); it renders as npm, pnpm, yarn and bun tabs. Use `<Tabs items={["A", "B"]}>` with `<Tab value="A">` only for other real alternatives.
- Tables for options: `Option | Type | Default | What it does`.
- Use `<Callout>` (`type="info"`, `"warn"`, `"error"` or `"idea"`) sparingly, at most one per page. No imports needed; `Callout`, `Tabs`, `Tab`, `Steps` and `Step` are available in every page.
- Link between pages with root-relative links without a trailing slash (`/guides/flows`, `/guides/flows#the-flow-viewer`).
- Order and group pages in `meta.json`: the root one lists the sections with `---Start here---` style separators, and `guides/meta.json` and `reference/meta.json` list their pages in order. A new page must be added there.
- No "·" separators, no emoji, no exclamation marks. Say "you". Name things the way the UI names them (Screens, Flows, Components, Annotate, Reconcile, Variants).
