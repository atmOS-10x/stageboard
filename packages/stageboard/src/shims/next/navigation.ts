type Win = Window & { __STAGEBOARD_ROUTE__?: string; __STAGEBOARD_PARAMS__?: Record<string, string> }

function win(): Win | undefined {
  return typeof window === "undefined" ? undefined : (window as Win)
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
  pathname: "/",
  query: {},
  asPath: "/",
  events: { on: () => {}, off: () => {}, emit: () => {} },
  isReady: true,
}

export function useRouter() {
  return router
}
export function usePathname(): string {
  return win()?.__STAGEBOARD_ROUTE__ ?? "/"
}
export function useSearchParams(): URLSearchParams {
  return new URLSearchParams()
}
export function useParams<T = Record<string, string>>(): T {
  return (win()?.__STAGEBOARD_PARAMS__ ?? {}) as T
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
