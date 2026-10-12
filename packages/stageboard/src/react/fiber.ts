import type { ComponentFrame } from "../core/protocol"
import { VARIANT_MARKER } from "./variant"

type Fiber = {
  tag: number
  type: any
  elementType: any
  stateNode: any
  return: Fiber | null
  child: Fiber | null
  sibling: Fiber | null
  memoizedProps: any
  _debugOwner?: Fiber | null
  _debugStack?: Error | { stack?: string } | null
  _debugSource?: { fileName: string; lineNumber?: number; columnNumber?: number }
}

const STOP_NAMES = new Set([
  "LayoutRouterContext",
  "InnerLayoutRouter",
  "OuterLayoutRouter",
  "RenderFromTemplateContext",
  "TemplateContext",
  "ScrollAndFocusHandler",
  "InnerScrollAndFocusHandler",
  "InnerScrollAndFocusHandlerNew",
  "ScrollAndMaybeFocusHandler",
  "AppRouter",
  "Router",
  "HotReload",
  "ClientPageRoot",
  "ClientSegmentRoot",
])

const HOST_COMPONENT = 5
const HOST_ROOT = 3

const SKIP_NAMES = new Set([
  "StageboardVariant",
  "Variantable",
  "Suspense",
  "Fragment",
  "StrictMode",
  "Profiler",
  "ErrorBoundary",
  "InnerLayoutRouter",
  "OuterLayoutRouter",
  "RenderFromTemplateContext",
  "ScrollAndFocusHandler",
  "InnerScrollAndFocusHandler",
  "LoadingBoundary",
  "HTTPAccessFallbackBoundary",
  "HTTPAccessFallbackErrorBoundary",
  "RedirectBoundary",
  "RedirectErrorBoundary",
  "ClientPageRoot",
  "ClientSegmentRoot",
  "SegmentViewNode",
  "SegmentStateProvider",
  "MetadataOutlet",
  "AsyncMetadataOutlet",
])

export function fiberFromElement(el: Element | null): Fiber | null {
  if (!el) return null
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
      return (el as unknown as Record<string, Fiber>)[key]
    }
  }
  return null
}

export function componentName(type: any): string | undefined {
  if (!type || typeof type === "string") return undefined
  if (typeof type === "function") return type.displayName || type.name || undefined
  if (typeof type === "object") {
    return (
      type.displayName ||
      componentName(type.render) ||
      componentName(type.type) ||
      undefined
    )
  }
  return undefined
}

function isUserComponent(name: string | undefined): name is string {
  if (!name) return false
  if (SKIP_NAMES.has(name) || name.startsWith("Stageboard")) return false
  if (name.startsWith("_") || name.length <= 2) return false
  if (/(Context|Provider|Boundary|Guard|Adapter)$/.test(name)) return false
  return /^[A-Z]/.test(name)
}

const STACK_URL = /(?:at\s+(?:.*?\()?|@)((?:https?|file|webpack-internal|rsc):\/\/[^\s)]+?):(\d+):(\d+)/

function parseStackFrame(stack: string | undefined): ComponentFrame["source"] {
  if (!stack) return undefined
  for (const line of stack.split("\n")) {
    const m = STACK_URL.exec(line)
    if (!m) continue
    const url = m[1]
    if (/node_modules|react-dom|react\.development|jsx-dev-runtime|\/_next\/static\/chunks\/(?!.*app)/.test(url)) continue
    let file = url
    try {
      const u = new URL(url)
      file = decodeURIComponent(u.pathname)
    } catch {}
    file = file.replace(/^\/__stageboard(?=\/)/, "").replace(/^\/@fs/, "")
    return { file, line: Number(m[2]), column: Number(m[3]) }
  }
  return undefined
}

function ownedChild(fiber: Fiber): Fiber | null {
  const stack: Fiber[] = fiber.child ? [fiber.child] : []
  let steps = 0
  while (stack.length && steps++ < 500) {
    const f = stack.shift()!
    if (f._debugOwner === fiber) return f
    if (f.sibling) stack.push(f.sibling)
    if (f.child) stack.push(f.child)
  }
  return null
}

function definitionSource(fiber: Fiber): ComponentFrame["source"] {
  if (fiber._debugSource) {
    return {
      file: fiber._debugSource.fileName,
      line: fiber._debugSource.lineNumber,
      column: fiber._debugSource.columnNumber,
    }
  }
  const owned = ownedChild(fiber)
  return parseStackFrame(owned?._debugStack?.stack)
}

export function componentChain(el: Element, limit = 12): ComponentFrame[] {
  const frames: ComponentFrame[] = []
  let fiber = fiberFromElement(el)
  while (fiber && frames.length < limit) {
    const name = componentName(fiber.type)
    if (name && STOP_NAMES.has(name)) break
    if (isUserComponent(name) && frames[frames.length - 1]?.name !== name) {
      frames.push({ name, source: definitionSource(fiber) })
    }
    fiber = fiber.return
  }
  return frames
}

function isVariantFiber(fiber: Fiber): boolean {
  return Boolean(fiber.type && fiber.type[VARIANT_MARKER])
}

export function nearestVariant(el: Element): { id: string; active: string } | undefined {
  let fiber = fiberFromElement(el)
  while (fiber) {
    if (isVariantFiber(fiber)) return { id: fiber.memoizedProps.id, active: fiber.memoizedProps.active }
    fiber = fiber.return
  }
  return undefined
}

function rootFiber(): Fiber | null {
  const candidates = [document.body, document.documentElement, document.body?.firstElementChild]
  for (const el of candidates) {
    let fiber = fiberFromElement(el ?? null)
    while (fiber?.return) fiber = fiber.return
    if (fiber?.tag === HOST_ROOT) return fiber
  }
  for (const el of Array.from(document.querySelectorAll("body *")).slice(0, 50)) {
    let fiber = fiberFromElement(el)
    while (fiber?.return) fiber = fiber.return
    if (fiber?.tag === HOST_ROOT) return fiber
  }
  return null
}

function topHostNodes(fiber: Fiber): Element[] {
  const out: Element[] = []
  const walk = (f: Fiber | null) => {
    while (f) {
      if (f.tag === HOST_COMPONENT && f.stateNode instanceof Element) out.push(f.stateNode)
      else walk(f.child)
      f = f.sibling
    }
  }
  walk(fiber.child)
  return out
}

export function variantBoundaryRects(id: string): DOMRect[] {
  const root = rootFiber()
  if (!root) return []
  const rects: DOMRect[] = []
  const stack: Fiber[] = [root]
  let steps = 0
  while (stack.length && steps++ < 50000) {
    const f = stack.pop()!
    if (isVariantFiber(f) && f.memoizedProps?.id === id) {
      const nodes = topHostNodes(f)
      if (nodes.length) rects.push(unionRect(nodes.map((n) => n.getBoundingClientRect())))
      continue
    }
    if (f.sibling) stack.push(f.sibling)
    if (f.child) stack.push(f.child)
  }
  return rects
}

export function unionRect(rects: DOMRect[]): DOMRect {
  const visible = rects.filter((r) => r.width || r.height)
  const list = visible.length ? visible : rects
  const x1 = Math.min(...list.map((r) => r.left))
  const y1 = Math.min(...list.map((r) => r.top))
  const x2 = Math.max(...list.map((r) => r.right))
  const y2 = Math.max(...list.map((r) => r.bottom))
  return new DOMRect(x1, y1, x2 - x1, y2 - y1)
}

export function cssPath(el: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && node.nodeType === 1 && parts.length < 6) {
    const testId = node.getAttribute("data-testid") || node.getAttribute("data-slot")
    if (node.id && !/\d{3,}|:/.test(node.id)) {
      parts.unshift(`#${CSS.escape(node.id)}`)
      break
    }
    let part = node.tagName.toLowerCase()
    if (testId) part += `[data-${node.hasAttribute("data-testid") ? "testid" : "slot"}="${testId}"]`
    const parent: Element | null = node.parentElement
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName)
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`
    }
    parts.unshift(part)
    node = parent
  }
  return parts.join(" > ")
}

export function describeRegion(rect: { x: number; y: number; width: number; height: number }) {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const own = (el: Element) => Boolean(el.closest?.("[data-stageboard-devtools]"))
  const candidates = document.elementsFromPoint(cx, cy).filter((el) => !own(el) && el !== document.documentElement && el !== document.body)
  const fitting = candidates.find((el) => {
    const r = el.getBoundingClientRect()
    return r.width >= rect.width * 0.6 && r.height >= rect.height * 0.6
  }) ?? candidates[0]
  const used = Array.from(((globalThis as Record<string, unknown>).__STAGEBOARD_USED__ as Set<string> | undefined) ?? [])
  const variantIds = used.filter((id) =>
    variantBoundaryRects(id).some((r) => r.right > rect.x && r.left < rect.x + rect.width && r.bottom > rect.y && r.top < rect.y + rect.height),
  )
  return {
    components: fitting ? componentChain(fitting) : [],
    variantIds,
    selector: fitting ? cssPath(fitting) : undefined,
    tag: fitting?.tagName.toLowerCase(),
    text: fitting ? (fitting.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240) || undefined : undefined,
  }
}
