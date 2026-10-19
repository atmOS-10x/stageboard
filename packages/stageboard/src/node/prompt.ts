import { formatAction, type ChangeRequest, type FlowStep, type Job, type Region, type SketchOp } from "../core/protocol"
import type { ResolvedConfig } from "./config"

function pageContext(request: ChangeRequest) {
  const t = request.target
  return {
    url: t.url,
    title: t.title,
    selector: t.selector,
    text: t.text,
    components: t.components.map((c) => ({
      name: c.name,
      sourcePath: c.source?.file,
      sourceLine: c.source?.line,
    })),
    selection: { tag: t.tag, rect: t.rect },
    viewport: t.viewport,
    variant: t.variantId ? { id: t.variantId, active: t.variantKey } : undefined,
    story: t.storyId,
  }
}

function shotHint(config: ResolvedConfig, job: Job, request: ChangeRequest): string {
  const story = request.target.storyId
  const variantFlag = job.variantId ? ` --variant ${job.variantId}=<key>` : ""
  const lines = [
    "## Seeing your work",
    `Render any story to a PNG without running the app: \`npx stageboard shot <story-id>${variantFlag} --out /tmp/shot.png\` (run from ${config.root}), then look at the image.`,
    "A variant's key is its file name without `.variant.tsx` (for `hero.editorial.variant.tsx` it is `hero.editorial`).",
    "List stories with `npx stageboard list`. Use `--width 1440` for page-sized stories and `--full` for the full scroll height.",
  ]
  if (story) lines.push(`The user selected this inside story \`${story}\`; start from that one.`)
  lines.push("Look at at least one screenshot of each result before you finish, and fix anything that looks broken.")
  return lines.join("\n")
}

const VARIANT_FORMAT = (variantId: string, jobId: string) => `Each variant is ONE new file next to the original component, named \`<component>.<short-slug>.variant.tsx\` (kebab-case slug, unique). The file must look like this:

\`\`\`tsx
export const variant = {
  of: "${variantId}",
  label: "Short human name",
  description: "One sentence on what is different and why.",
  job: "${jobId}",
}

export default function HeroEditorial(props: HeroProps) {
  // full, self-contained implementation with the same props as the original
}
\`\`\`

stageboard picks the file up automatically and the user sees it live in the variant picker. Do not edit the generated registry file.`

function contextSection(job: Job, request: ChangeRequest): string {
  const t = request.target
  const lines: string[] = []
  if (t.region && t.storyId && !request.sketch) {
    lines.push(
      "## What the user marked",
      `They dragged a rectangle over story \`${t.storyId}\` at x=${Math.round(t.region.x)}, y=${Math.round(t.region.y)}, ${Math.round(t.region.width)}×${Math.round(t.region.height)} px in a ${t.viewport.width}×${t.viewport.height} viewport.`,
    )
    if (job.selectionImage) lines.push(`A screenshot of exactly that area (with a little margin) is at \`${job.selectionImage}\`. Open it before you start.`)
    if (t.components.length) lines.push(`Components under the selection, innermost first: ${t.components.map((c) => c.name).join(" ← ")}.`)
  }
  if (job.attachments?.length) {
    lines.push("", "## Reference images from the user")
    for (const a of job.attachments) lines.push(`- \`${a.path}\` (${a.name})`)
    lines.push("Look at each one; they show what the user has in mind.")
  }
  const keys = Object.entries(t.variantKeys ?? {})
  if (request.showVariants || keys.length) {
    lines.push("", "## Variants in view")
    if (keys.length) lines.push(`The user was looking at ${keys.map(([id, key]) => `variant \`${key}\` of \`${id}\``).join(", ")} in the variants gallery, so the note is about that variant.`)
    lines.push(
      "Compare it with its siblings before changing anything (stageboard MCP `compare_variants`, or one `npx stageboard shot` per variant).",
      request.kind === "edit"
        ? "Edit that variant's own `*.variant.tsx` file; leave the original and the other variants alone unless the note says otherwise."
        : "New variants should build on the one the user pointed at.",
    )
  }
  return lines.join("\n")
}

function doneSection(config: ResolvedConfig, job: Job): string {
  return [
    "## When you are done",
    `Your job id is \`${job.id}\`. As your very last step, report it finished so the user's board stops showing it as running:`,
    `call the stageboard MCP tool \`complete_job\` with job \`${job.id}\` and a one-sentence summary, or run \`npx stageboard done ${job.id} "<summary>"\` from ${config.root}.`,
    "Add `failed: true` (or `--failed`) if you could not do what was asked.",
  ].join("\n")
}

const MCP_HINT = [
  "## stageboard tools",
  "If a `stageboard` skill is installed (.claude/skills or .agents/skills), follow it.",
  "If the `stageboard` MCP server is connected, use its tools: `list_stories`, `screenshot` (story, optional variants, region or full page), `list_variants`, `compare_variants` and `select_variant` and `complete_job`. They work without the app running. Otherwise use the `npx stageboard` CLI described below.",
].join("\n")

function box(r: Region): string {
  return `x=${Math.round(r.x)}, y=${Math.round(r.y)}, ${Math.round(r.width)}×${Math.round(r.height)}`
}

function describeOp(op: SketchOp): string {
  const who = (c: { name: string }[]) => (c.length ? ` (\`${c.slice(0, 3).map((f) => f.name).join(" ← ")}\`)` : "")
  if (op.type === "move") {
    const resized = op.to.width !== op.from.width || op.to.height !== op.from.height
    return `- Moved${resized ? " and resized" : ""} the element \`${op.selector}\`${who(op.components)}${op.text ? ` showing "${op.text.slice(0, 60)}"` : ""} from ${box(op.from)} to ${box(op.to)}.`
  }
  if (op.type === "text") return `- Changed the text of \`${op.selector}\`${who(op.components)} from "${op.before}" to "${op.after}".`
  if (op.type === "block") return `- Drew a ${op.color} block at ${box(op.rect)}${op.label ? ` labelled "${op.label}"` : ""}: something should go there.`
  if (op.type === "component") return `- Placed the existing component from story \`${op.storyId}\` (${op.title}) at ${box(op.rect)}: reuse that component there.`
  const xs = op.points.map((p) => p.x)
  const ys = op.points.map((p) => p.y)
  return `- Drew a freehand ${op.color} mark around x=${Math.round(Math.min(...xs))}–${Math.round(Math.max(...xs))}, y=${Math.round(Math.min(...ys))}–${Math.round(Math.max(...ys))}.`
}

// Annotations the user collected while going through a flow: comments on regions and sketches, screen by screen.
function batchSection(job: Job, request: ChangeRequest, screens: Screen[]): string[] {
  const list = request.annotations ?? []
  if (!list.length) return []
  const byId = new Map(screens.map((s) => [s.id, s]))
  const [whole, each] = request.component ? ["component", "story"] : ["flow", "screen"]
  const lines = [
    "",
    `## The user's annotations, ${each} by ${each}`,
    `They went through the ${whole} and marked up ${list.length} place${list.length === 1 ? "" : "s"}. Handle every one; they belong together, so keep the ${each === "story" ? "stories" : "screens"} consistent. Coordinates are page pixels in the ${each}'s viewport.`,
  ]
  let sketched = false
  for (const [i, a] of list.entries()) {
    const screen = byId.get(a.storyId)
    const images = (job.images ?? []).filter((img) => img.label.startsWith(`${i + 1}:`))
    lines.push("", `### ${i + 1}. ${a.step !== undefined ? `${request.component ? "Story" : "Screen"} ${a.step + 1}: ` : ""}${a.title ?? screen?.title ?? a.storyId} (\`${a.storyId}\`${screen ? `, ${screen.file}` : ""})`)
    if (a.note) lines.push(`Note: ${a.note}`)
    if (a.region) lines.push(`About the area at ${box(a.region)} in a ${a.viewport.width}×${a.viewport.height} viewport.`)
    if (a.sketch?.ops.length) {
      sketched = true
      lines.push(`They sketched on this ${each} (nothing was changed in code; this is the state they want):`, ...a.sketch.ops.map(describeOp))
    }
    for (const img of images) {
      const kind = img.label.split(":")[1]
      lines.push(`${kind === "selection" ? "Screenshot of that area" : kind === "before" ? "Before" : "After, with the sketch applied"}: \`${img.path}\``)
    }
  }
  lines.push("", `Open every screenshot before you start. Screenshot each ${each} you change with \`npx stageboard shot <story-id>\` afterwards.`)
  if (sketched)
    lines.push("Treat moves and resizes as layout intent, not pixel offsets: change the layout so the screen looks like the sketch at every width. Blocks and freehand marks are rough placeholders for what the notes ask for.")
  return lines
}

function sketchSection(job: Job, request: ChangeRequest): string {
  const sketch = request.sketch
  if (!sketch?.ops.length) return ""
  const lines = [
    "## The user's sketch",
    `They edited the live page directly in a ${sketch.viewport.width}×${sketch.viewport.height} viewport scrolled to x=${Math.round(sketch.scroll.x)}, y=${Math.round(sketch.scroll.y)} (coordinates below are page pixels). Nothing was changed in code; this is the state they want:`,
    ...sketch.ops.map(describeOp),
  ]
  if (job.selectionImage) lines.push(`Before: \`${job.selectionImage}\`.`)
  if (job.sketchImage) lines.push(`After, with the sketch applied: \`${job.sketchImage}\`. Open both before you start.`)
  lines.push(
    "Treat moves and resizes as layout intent, not pixel offsets: change the layout (order, grid, flex, sizes) so the page looks like the sketch at every width. Blocks and freehand marks are rough placeholders for what the note asks for. Text edits may be placeholders too; use them unless the note says otherwise.",
  )
  return lines.join("\n")
}

type Screen = { id: string; title: string; file: string }

const STEP_FIELDS = [
  "Describe every step, in the app's language, so someone looking at the flow knows what is going on:",
  "- `note`: what is happening on this screen, one short sentence (e.g. The practice enters its email to get a sign-in code).",
  "- `actions`: what the user does on this screen, in order, played back with a cursor in the viewer: `{ \"do\": \"click\" | \"type\" | \"press\" | \"hover\" | \"scroll\" | \"wait\", \"target\"?: visible text, aria-label, placeholder or label of the element (or a CSS selector), \"text\"?: what to type, the key to press, or ms to wait }`. Example: open settings, then the phone menu editor: `[{ \"do\": \"click\", \"target\": \"Einstellungen\" }, { \"do\": \"click\", \"target\": \"Telefonmenü bearbeiten\" }]`. The last action is usually what takes the user to the next step. A screen the user only looks at needs none.",
  "- Check the actions play: `npx stageboard flow shot <flow>` plays every step's actions before capturing it and reports any that fail (a target it cannot find).",
]

function stepLine(s: FlowStep, i: number, screen?: Screen): string {
  const head = `${i + 1}. ${s.storyId ? `\`${s.storyId}\`` : `(not built yet: ${s.pending ?? "pending"})`}${screen ? ` — ${screen.title} (${screen.file})` : ""}`
  const parts = [s.note && `note: ${s.note}`, s.actions?.length && `actions: ${s.actions.map(formatAction).join(" → ")}`].filter(Boolean)
  return parts.length ? `${head} (${parts.join("; ")})` : head
}

function flowPrompt(config: ResolvedConfig, job: Job, request: ChangeRequest, screens: Screen[]): string[] {
  const flow = request.flow
  const list = screens.length ? screens.map((s) => `- \`${s.id}\` — ${s.title} (${s.file})`) : ["(no page stories yet)"]
  const save = [
    "## Saving",
    "Save with the stageboard MCP tool `save_flow`, or `npx stageboard flow save '<json>'` from " + config.root + ", where the JSON is",
    `\`{ ${flow ? `"flow": "${flow.id}", ` : ""}"name": "…", "group": "…", "description": "…", "steps": [{ "storyId": "<page story id>", "note": "what happens here", "actions": [{ "do": "click", "target": "Weiter" }] }, { "pending": "Screen you are still building" }] }\`.`,
    ...STEP_FIELDS,
    "Steps are screens in the order the user sees them. Save early with `pending` steps for screens you still have to build, so the user watches the flow fill in, then save again with real story ids once they exist.",
  ]
  if (!flow) {
    return [
      "Suggest the main user flows of this app for the stageboard Flows view (like Mobbin's flows): the 5–10 journeys a real user goes through, each an ordered list of screens.",
      "",
      `What the user asked for: ${request.note}`,
      "",
      "Use the existing page stories below as steps; read the app's routes and navigation to get the order right. Only build a new screen or state story when a flow cannot make sense without it. Group related flows with the same `group` (for example Onboarding, Inbox, Settings).",
      "Save each flow separately (no `flow` id).",
      "",
      "## Screens that exist (page stories)",
      ...list,
      "",
      ...save,
    ]
  }
  return [
    `Assemble the user flow "${flow.name}" for the stageboard Flows view: an ordered list of screens a user goes through.`,
    "",
    `What the user described: ${flow.description ?? request.note}`,
    "",
    "## How",
    "1. Pick the screens from the existing page stories below, in the order the user sees them. A flow usually needs specific states (a dialog open, a form half filled, a success message): find a story that shows that state or create one.",
    "2. For every screen or state that does not exist yet, add a page story with mock data next to the related ones, copying how they render pages (`parameters.page` with `route`, `title`, `group`). Build new screens as real app code when the flow needs a page the app does not have.",
    "3. Render each new story with `npx stageboard shot <story-id>` and look at it.",
    "",
    "## Screens that exist (page stories)",
    ...list,
    "",
    ...save,
  ]
}

function flowNotePrompt(request: ChangeRequest, screens: Screen[]): string[] {
  const flow = request.flow!
  const byId = new Map(screens.map((s) => [s.id, s]))
  return [
    `Change the user flow "${flow.name}" as the user asks below. The note is about the whole flow, not one screen: apply it to every screen it concerns, keep the screens consistent with each other, and leave screens alone that it does not touch.`,
    "",
    "## The flow, in order",
    ...flow.steps.map((s, i) => stepLine(s, i, s.storyId ? byId.get(s.storyId) : undefined)),
    "Screenshot each screen with `npx stageboard shot <story-id>` before and after. If the note changes which screens the flow has, their order or how a step is described, save the whole flow with the stageboard MCP tool `save_flow` (or `npx stageboard flow save`), passing flow id `" + flow.id + "` and every step with its `storyId`, `note` and `actions`.",
    ...STEP_FIELDS,
  ]
}

function componentNotePrompt(request: ChangeRequest, screens: Screen[]): string[] {
  const group = request.component!
  const byId = new Map(screens.map((s) => [s.id, s]))
  const file = group.stories.map((s) => byId.get(s.id)?.file).find(Boolean)
  return [
    `Change the component "${group.title}" as the user asks below. The note is about the component as a whole, seen across all of its stories (its states and variants): change the component itself so every story reflects it, keep them consistent with each other, and only add, remove or rewrite stories when the note asks for that.`,
    "",
    `## Its stories${file ? ` (in ${file})` : ""}`,
    ...group.stories.map((s, i) => `${i + 1}. \`${s.id}\` — ${s.name}`),
    "Screenshot the stories you touch with `npx stageboard shot <story-id>` before and after; it renders each in its own frame (`parameters.viewport`).",
  ]
}

function pagePrompt(job: Job, request: ChangeRequest): string[] {
  const dream = request.dream!
  const parent = request.target.storyId
  return [
    `Create a new page in this app${dream.name ? ` called "${dream.name}"` : ""}.`,
    "",
    `What the user asked for: ${dream.prompt}`,
    "",
    parent
      ? `They added it to a flow right after the page story \`${parent}\`, so it belongs next to that page: same shell, navigation and layout, reached from it.${job.selectionImage ? ` A screenshot of that page is at \`${job.selectionImage}\`; open it first.` : ""}`
      : "They added it in stageboard.",
    "",
    "## What to build",
    "1. The page itself as real app code, following the project's conventions for pages and routes (look at how the parent page is built and routed). Reuse existing components; keep strings, data access and styling in the project's patterns.",
    "2. A page story so it appears in stageboard's Screens, next to the parent's page story (read that story file and copy how it renders a page with mock data):",
    `   \`parameters: { page: { route: "<its route>", title: "<page title>", group: "<the parent's group>", links: [...], dream: "${dream.id}" } }\` — the \`dream\` id is how stageboard swaps the placeholder for your page, so it must be exactly \`${dream.id}\`.`,
    "3. Add the new route to the parent page story's `links` (and real navigation to it in the app, if the request implies one).",
    "Render the new story with `npx stageboard shot <story-id> --width 1440` and look at it until it is right.",
  ]
}

export function buildPrompt(config: ResolvedConfig, job: Job, request: ChangeRequest, screens: Screen[] = []): string {
  const target = request.target
  const top = target.components[0]
  const lines: string[] = []

  const sketched = Boolean(request.sketch?.ops.length)
  if (request.kind === "flow") {
    lines.push(...flowPrompt(config, job, request, screens))
  } else if (request.kind === "page") {
    lines.push(...pagePrompt(job, request))
  } else if (request.kind === "variants") {
    lines.push(
      sketched
        ? `Create ${job.count} distinct design variant${job.count === 1 ? "" : "s"} of the part of the page the user sketched over, each taking the sketch below as its direction.`
        : `Create ${job.count} distinct design variant${job.count === 1 ? "" : "s"} of the \`${top?.name ?? target.tag}\` component the user pointed at.`,
      "",
      `What the user asked for: ${request.note}`,
      "",
      "Make the variants genuinely different directions from each other, not small tweaks. Keep the same props/data contract so a variant can replace the original without changes elsewhere. Do not modify the original component.",
      "",
    )
    if (target.variantId) {
      lines.push(`The component is already wrapped as variant boundary \`${target.variantId}\`.`, "", VARIANT_FORMAT(target.variantId, job.id))
    } else {
      lines.push(
        "The component is not wrapped in a variant boundary yet. First wrap it, without changing its behaviour:",
        "- for a component: rename the implementation and export `export const Hero = variant(\"<area>.<component>\", HeroImpl)` from `@atmos.build/stageboard/react`, keeping the exported name the same;",
        "- or for an inline JSX section: wrap it in `<Variant id=\"<area>.<section>\">…</Variant>`.",
        "Choose a stable dotted id such as `landing.hero`. Then create the variants for that id.",
        "",
        VARIANT_FORMAT("<the id you chose>", job.id),
      )
    }
  } else if (request.kind === "edit" && request.component) {
    lines.push(...componentNotePrompt(request, screens), "", `What the user asked for: ${request.note}`, ...batchSection(job, request, screens))
  } else if (request.kind === "edit" && request.flow) {
    lines.push(...flowNotePrompt(request, screens), "", `What the user asked for: ${request.note}`, ...batchSection(job, request, screens))
  } else if (request.kind === "edit") {
    lines.push(
      sketched ? "Make the page match the user's sketch below, directly in place." : `Change the \`${top?.name ?? target.tag}\` component the user pointed at, directly in place.`,
      "",
      `What the user asked for: ${request.note}`,
    )
  } else {
    lines.push(
      `Adopt variant \`${request.adoptKey}\` of boundary \`${target.variantId}\` as the new original.`,
      "Port its implementation into the original component (keep the variant boundary and its id), then delete that variant file. Leave other variants alone.",
      request.note ? `\nAdditional notes: ${request.note}` : "",
    )
  }

  const context = request.kind === "page" || request.kind === "flow" || request.flow || request.component ? "" : contextSection(job, request)
  if (context) lines.push("", context)
  const sketch = sketchSection(job, request)
  if (sketch) lines.push("", sketch)
  lines.push("", MCP_HINT)
  lines.push("", shotHint(config, job, request))
  lines.push(
    "",
    "## Rules",
    "- Work in the current working tree. Do not commit, push, or start dev servers.",
    "- Follow the project's existing conventions (read nearby files and any CLAUDE.md / AGENTS.md).",
    "- Finish with a one-line summary per change.",
  )
  lines.push("", doneSection(config, job))
  if (config.instructions) lines.push("", "## Project notes", config.instructions.trim())
  lines.push("", "Page context (JSON):", JSON.stringify(pageContext(request), null, 2))
  return lines.join("\n")
}
