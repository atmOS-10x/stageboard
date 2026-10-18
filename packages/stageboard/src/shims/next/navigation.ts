type Params = Record<string, string | string[]>
type Win = Window & { __STAGEBOARD_ROUTE__?: string; __STAGEBOARD_PATH__?: string; __STAGEBOARD_PARAMS__?: Params }

function win(): Win | undefined {
  return typeof window === "undefined" ? undefined : (window as Win)
}

// The story's own URL, set by the frame from parameters.page: `path` if given, else the route with its params.
function url(): URL {
  const w = win()
  return new URL(w?.__STAGEBOARD_PATH__ ?? w?.__STAGEBOARD_ROUTE__ ?? "/", "http://stageboard.local")
}

function params(): Params {
  return win()?.__STAGEBOARD_PARAMS__ ?? {}
}

function navigate(href: string) {
  win()?.parent?.postMessage({ source: "stageboard", type: "navigate", href }, "*")
}

const router = {
  push: navigate,
  replace: navigate,
  prefetch: () => Promise.resolve(),
  back: () => {},
  forward: () => {},
  refresh: () => {},
  get pathname() {
    return win()?.__STAGEBOARD_ROUTE__ ?? "/"
  },
  get query() {
    return { ...Object.fromEntries(url().searchParams), ...params() }
  },
  get asPath() {
    const u = url()
    return `${u.pathname}${u.search}${u.hash}`
  },
  events: { on: () => {}, off: () => {}, emit: () => {} },
  isReady: true,
}

export function useRouter() {
  return router
}
export function usePathname(): string {
  return url().pathname
}
export function useSearchParams(): URLSearchParams {
  return url().searchParams
}
export function useParams<T = Params>(): T {
  return params() as T
}
export function useSelectedLayoutSegment(): string | null {
  return null
}
export function useSelectedLayoutSegments(): string[] {
  return []
}
export function redirect(href: string): never {
  navigate(href)
  throw new Error(`redirect(${href})`)
}
export const permanentRedirect = redirect
export function notFound(): never {
  throw new Error("notFound()")
}
export const RedirectType = { push: "push", replace: "replace" }
export const ReadonlyURLSearchParams = URLSearchParams
export default router
