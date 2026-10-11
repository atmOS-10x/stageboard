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

  lines.push("", shotHint(config, job, request))
  lines.push(
    "",
    "## Rules",
    "- Work in the current working tree. Do not commit, push, or start dev servers.",
    "- Follow the project's existing conventions (read nearby files and any CLAUDE.md / AGENTS.md).",
    "- Finish with a one-line summary per change.",
  )
  if (config.instructions) lines.push("", "## Project notes", config.instructions.trim())
  lines.push("", "Page context (JSON):", JSON.stringify(pageContext(request), null, 2))
  return lines.join("\n")
}
