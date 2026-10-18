import { DocsLayout } from "fumadocs-ui/layouts/notebook"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout tree={source.getPageTree()} {...baseOptions()} nav={{ ...baseOptions().nav, mode: "top" }}>
      {children}
    </DocsLayout>
  )
}
