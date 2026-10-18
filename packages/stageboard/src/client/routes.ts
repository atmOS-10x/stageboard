// Route patterns as stories write them: `/stays/[id]`, `/stays/:id`, `/docs/[...slug]`, `/[[...slug]]`.
export type RouteParams = Record<string, string | string[]>

type Seg = { kind: "static"; value: string } | { kind: "param"; name: string } | { kind: "rest"; name: string; optional: boolean }

function segments(path: string): string[] {
  return path.split(/[?#]/)[0].split("/").filter(Boolean)
}

function parse(route: string): Seg[] {
  return segments(route)
    .filter((s) => !/^\(.*\)$/.test(s))
    .map((s): Seg => {
      const rest = /^\[(\[)?\.\.\.([^\]]+)\]\]?$/.exec(s)
      if (rest) return { kind: "rest", name: rest[2], optional: Boolean(rest[1]) }
      const param = /^\[([^\]]+)\]$/.exec(s) ?? /^:(\w+)\??$/.exec(s)
      if (param) return { kind: "param", name: param[1] }
      if (s === "*") return { kind: "rest", name: "*", optional: true }
      return { kind: "static", value: s }
    })
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** The params of `path` under `route`, or undefined when it doesn't match. */
export function matchRoute(route: string, path: string): RouteParams | undefined {
  const pattern = parse(route)
  const parts = segments(path).map(decode)
  const params: RouteParams = {}
  for (const [i, seg] of pattern.entries()) {
    if (seg.kind === "rest") {
      const rest = parts.slice(i)
      if (!rest.length && !seg.optional) return undefined
      if (rest.length) params[seg.name] = rest
      return params
    }
    const part = parts[i]
    if (part === undefined) return undefined
    if (seg.kind === "static" && seg.value.toLowerCase() !== part.toLowerCase()) return undefined
    if (seg.kind === "param") params[seg.name] = part
  }
  return parts.length === pattern.length ? params : undefined
}

// More literal segments win: `/stays/new` beats `/stays/[id]` for the path `/stays/new`.
function specificity(route: string): number {
  return parse(route).reduce((n, s) => n + (s.kind === "static" ? 3 : s.kind === "param" ? 2 : 1), 0)
}

const norm = (route: string) => `/${segments(route).join("/")}`.toLowerCase()

/** The screen a link or `router.push` goes to: an exact route first, then the most specific pattern that matches. */
export function findScreen<T extends { page: { route: string } }>(screens: T[], href: string): T | undefined {
  const path = segments(href).join("/")
  const exact = screens.find((s) => norm(s.page.route) === `/${path}`.toLowerCase())
  if (exact) return exact
  let best: T | undefined
  let score = -1
  for (const s of screens) {
    if (!matchRoute(s.page.route, href)) continue
    const n = specificity(s.page.route)
    if (n > score) (best = s), (score = n)
  }
  return best
}

/** The path part of an href posted by a frame, or undefined when it points at another site. */
export function hrefPath(href: string, from = "/"): string | undefined {
  try {
    const base = `${location.origin}${from.startsWith("/") ? from : `/${from}`}`
    const url = new URL(href, base)
    if (url.origin !== location.origin) return undefined
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return undefined
  }
}

/** The route with its params filled in: `/stays/[id]` with `{ id: "42" }` is `/stays/42`. Unknown params stay as written. */
export function fillRoute(route: string, params: RouteParams): string {
  const out = segments(route).map((s) => {
    const seg = parse(s)[0]
    if (!seg) return ""
    if (seg.kind === "static") return s
    const v = params[seg.name]
    if (v === undefined) return s
    return (Array.isArray(v) ? v : [v]).map(encodeURIComponent).join("/")
  })
  return `/${out.filter(Boolean).join("/")}`
}
