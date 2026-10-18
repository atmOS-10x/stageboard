import type { ChangeRequest, Job } from "../core/protocol"
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
  if (t.region && t.storyId) {
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

export function buildPrompt(config: ResolvedConfig, job: Job, request: ChangeRequest): string {
  const target = request.target
  const top = target.components[0]
  const lines: string[] = []

  if (request.kind === "variants") {
    lines.push(
      `Create ${job.count} distinct design variant${job.count === 1 ? "" : "s"} of the \`${top?.name ?? target.tag}\` component the user pointed at.`,
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
      `Change the \`${top?.name ?? target.tag}\` component the user pointed at, directly in place.`,
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

  const context = contextSection(job, request)
  if (context) lines.push("", context)
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
