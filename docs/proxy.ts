import { isMarkdownPreferred } from "fumadocs-core/negotiation"
import { type NextRequest, NextResponse } from "next/server"

// Agents that ask for Markdown (Accept: text/markdown) get the page's Markdown at its normal URL.
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!isMarkdownPreferred(request) || pathname.includes(".") || pathname.startsWith("/api") || pathname.startsWith("/_next")) {
    return NextResponse.next()
  }
  const target = pathname === "/" ? "/llms.mdx" : `/llms.mdx${pathname.replace(/\/$/, "")}`
  return NextResponse.rewrite(new URL(target, request.nextUrl), { headers: { Vary: "Accept" } })
}

export const config = { matcher: ["/((?!_next|api|llms).*)"] }
