import type * as PageTree from "fumadocs-core/page-tree"
import { llmsDescription, llmsDetails, markdownUrl, siteUrl } from "@/lib/shared"
import { source } from "@/lib/source"

export const revalidate = false

// llms.txt (https://llmstxt.org): what stageboard is, then every page grouped like the sidebar,
// each linking to its Markdown version.
export function GET() {
  const lines = [
    "# stageboard",
    "",
    `> ${llmsDescription}`,
    "",
    llmsDetails,
    "",
    `Every page in full, as Markdown, in one file: ${siteUrl}/llms-full.txt`,
  ]

  let section: string[] = []
  const flush = () => {
    if (section.length > 1) lines.push("", ...section)
    section = []
  }
  const visit = (nodes: PageTree.Node[]) => {
    for (const node of nodes) {
      if (node.type === "separator") {
        flush()
        section.push(`## ${String(node.name ?? "")}`)
      } else if (node.type === "folder") {
        if (node.index) addPage(node.index.url)
        visit(node.children)
      } else {
        addPage(node.url)
      }
    }
  }
  const addPage = (url: string) => {
    const page = source.getPages().find((p) => p.url === url)
    if (!page) return
    if (section.length === 0) section.push("## Docs")
    const description = page.data.description ? `: ${page.data.description}` : ""
    section.push(`- [${page.data.title}](${siteUrl}${markdownUrl(page.slugs)})${description}`)
  }

  visit(source.getPageTree().children)
  flush()

  return new Response(`${lines.join("\n")}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}
