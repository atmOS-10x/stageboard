import type { ChangeRequest, Job, Region, SketchOp } from "../core/protocol"
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

function pagePrompt(job: Job, request: ChangeRequest): string[] {
  const dream = request.dream!
  const parent = request.target.storyId
  return [
    `Create a new page in this app${dream.name ? ` called "${dream.name}"` : ""}.`,
    "",
    `What the user asked for: ${dream.prompt}`,
    "",
    parent
      ? `They drew it out of the page story \`${parent}\` on the stageboard site map, so it belongs next to that page: same shell, navigation and layout, reached from it.${job.selectionImage ? ` A screenshot of that page is at \`${job.selectionImage}\`; open it first.` : ""}`
      : "They drew it on the stageboard site map.",
    "",
    "## What to build",
    "1. The page itself as real app code, following the project's conventions for pages and routes (look at how the parent page is built and routed). Reuse existing components; keep strings, data access and styling in the project's patterns.",
    "2. A page story so it appears on the site map, next to the parent's page story (read that story file and copy how it renders a page with mock data):",
    `   \`parameters: { page: { route: "<its route>", title: "<page title>", group: "<the parent's group>", links: [...], dream: "${dream.id}" } }\` — the \`dream\` id is how stageboard swaps the drawn frame for your page, so it must be exactly \`${dream.id}\`.`,
    "3. Add the new route to the parent page story's `links` (and real navigation to it in the app, if the request implies one).",
    "Render the new story with `npx stageboard shot <story-id> --width 1440` and look at it until it is right.",
  ]
}

export function buildPrompt(config: ResolvedConfig, job: Job, request: ChangeRequest): string {
  const target = request.target
  const top = target.components[0]
  const lines: string[] = []

  const sketched = Boolean(request.sketch?.ops.length)
  if (request.kind === "page") {
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
        "- for a component: rename the implementation and export `export const Hero = variant(\"<area>.<component>\", HeroImpl)` from `stageboard/react`, keeping the exported name the same;",
        "- or for an inline JSX section: wrap it in `<Variant id=\"<area>.<section>\">…</Variant>`.",
        "Choose a stable dotted id such as `landing.hero`. Then create the variants for that id.",
        "",
        VARIANT_FORMAT("<the id you chose>", job.id),
      )
    }
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

  const context = request.kind === "page" ? "" : contextSection(job, request)
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
