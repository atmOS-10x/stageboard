import { loader } from "fumadocs-core/source"
import { metaSchema, pageSchema } from "fumadocs-core/source/schema"
import { defineDocs } from "fumadocs-mdx/macro"
import { siteUrl } from "./shared"

const docs = defineDocs({
  dir: "src/content/docs",
  docs: {
    schema: pageSchema,
    postprocess: { includeProcessedMarkdown: { headingIds: false } },
  },
  meta: { schema: metaSchema },
})

// The docs are the whole site, so pages live at the root: /quick-start, /guides/flows.
export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
})

export type Page = (typeof source)["$inferPage"]

/** One page as Markdown for agents: title, URL, description, then the processed content. */
export async function getLLMText(page: Page) {
  const body = await page.data.getText("processed")
  const description = page.data.description ? `\n\n${page.data.description}` : ""
  return `# ${page.data.title}\n\nURL: ${siteUrl}${page.url}${description}\n\n${body}`
}
