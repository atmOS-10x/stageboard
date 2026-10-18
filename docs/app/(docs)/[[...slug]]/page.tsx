import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page"
import { createRelativeLink } from "fumadocs-ui/mdx"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getMDXComponents } from "@/components/mdx"
import { SiteFooter } from "@/components/site-footer"
import { githubFileUrl, markdownUrl, siteUrl } from "@/lib/shared"
import { source } from "@/lib/source"

type Props = { params: Promise<{ slug?: string[] }> }

export default async function Page(props: Props) {
  const { slug } = await props.params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full} tableOfContent={{ style: "clerk" }}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row flex-wrap items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl(page.slugs)} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl(page.slugs)}
          githubUrl={githubFileUrl(page.path)}
          pageUrl={`${siteUrl}${page.url}`}
        />
      </div>
      <DocsBody>
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
      <SiteFooter />
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params
  const page = source.getPage(slug)
  if (!page) notFound()

  return {
    title: page.slugs.length === 0 ? { absolute: "stageboard docs" } : page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url, types: { "text/markdown": markdownUrl(page.slugs) } },
  }
}
