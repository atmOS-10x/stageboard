import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Next would otherwise write an AGENTS.md into this folder on dev start.
  agentRules: false,
  // Lets the dev server answer on a Tailscale hostname for remote review.
  allowedDevOrigins: ["*.ts.net", "**.ts.net", "mac-studio.tail8983c8.ts.net"],
  async rewrites() {
    // Every page as Markdown: /quick-start.md, /guides/flows.mdx, /index.md for the introduction.
    return [
      { source: "/index.md", destination: "/llms.mdx" },
      { source: "/index.mdx", destination: "/llms.mdx" },
      { source: "/:path*.md", destination: "/llms.mdx/:path*" },
      { source: "/:path*.mdx", destination: "/llms.mdx/:path*" },
    ]
  },
}

export default withMDX(config)
