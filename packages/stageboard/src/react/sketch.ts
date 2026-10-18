import type { Region, SketchOp } from "../core/protocol"
import { componentChain } from "./fiber"

export type SketchTarget = {
  selector: string
  components: ReturnType<typeof componentChain>
  rect: Region
  text?: string
  editable: boolean
}

export type SketchApi = {
  apply: (ops: SketchOp[]) => void
  at: (clientX: number, clientY: number) => SketchTarget | undefined
  parentOf: (selector: string) => SketchTarget | undefined
  find: (selector: string) => SketchTarget | undefined
}

type Touched = { el: HTMLElement; style: string | null; text?: { node: Text; value: string } }

const LAYER_ID = "__sb-sketch"

function fullPath(el: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== document.body && node.parentElement) {
    const parent: Element = node.parentElement
    const index = Array.prototype.indexOf.call(parent.children, node) + 1
    parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`)
    node = parent
  }
  return `body > ${parts.join(" > ")}`
}

function pageRect(el: Element): Region {
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) }
}

function onlyText(el: Element): Text | undefined {
  const texts = Array.from(el.childNodes).filter((n): n is Text => n.nodeType === 3 && Boolean(n.textContent?.trim()))
  return texts.length === 1 && el.children.length === 0 ? texts[0] : undefined
}

function describe(el: Element | null): SketchTarget | undefined {
  if (!el || el === document.body || el === document.documentElement || el.closest(`#${LAYER_ID}`)) return undefined
  return {
    selector: fullPath(el),
    components: componentChain(el),
    rect: pageRect(el),
    text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || undefined,
    editable: Boolean(onlyText(el)),
  }
}

function query(selector: string): HTMLElement | null {
  try {
    return document.querySelector<HTMLElement>(selector)
  } catch {
    return null
  }
}

const INHERITED = ["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "white-space", "direction"]

function floatingCopy(el: HTMLElement, to: Region): HTMLElement {
  const computed = getComputedStyle(el)
  const copy = el.cloneNode(true) as HTMLElement
  copy.removeAttribute("id")
  copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"))
  for (const prop of INHERITED) copy.style.setProperty(prop, computed.getPropertyValue(prop))
  if (computed.backgroundColor === "rgba(0, 0, 0, 0)") {
    let p = el.parentElement
    while (p && getComputedStyle(p).backgroundColor === "rgba(0, 0, 0, 0)") p = p.parentElement
    if (p) copy.style.backgroundColor = getComputedStyle(p).backgroundColor
  }
  Object.assign(copy.style, {
    position: "absolute",
    left: `${to.x}px`,
    top: `${to.y}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    margin: "0",
    boxSizing: "border-box",
    translate: "none",
    transform: "none",
    maxWidth: "none",
    maxHeight: "none",
    zIndex: "1",
    visibility: "visible",
    pointerEvents: "none",
    outline: "1.5px dashed rgba(141,122,246,.9)",
    outlineOffset: "1px",
  })
  return copy
}

function strokePath(points: { x: number; y: number }[]): string {
  if (!points.length) return ""
  const [first, ...rest] = points
  return `M${first.x},${first.y}` + rest.map((p) => `L${p.x},${p.y}`).join("")
}

export function installSketch(base: string) {
  let touched: Touched[] = []

  const restore = () => {
    for (const t of touched.reverse()) {
      if (t.style === null) t.el.removeAttribute("style")
      else t.el.setAttribute("style", t.style)
      if (t.text) t.text.node.textContent = t.text.value
    }
    touched = []
    document.getElementById(LAYER_ID)?.remove()
  }

  const touch = (el: HTMLElement): Touched => {
    let t = touched.find((x) => x.el === el)
    if (!t) touched.push((t = { el, style: el.getAttribute("style") }))
    return t
  }

  const layer = () => {
    let el = document.getElementById(LAYER_ID)
    if (!el) {
      el = document.createElement("div")
      el.id = LAYER_ID
      el.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;z-index:2147483600;pointer-events:none"
      document.body.appendChild(el)
    }
    return el
  }

  const api: SketchApi = {
    apply(ops) {
      restore()
      const svg: string[] = []
      // Text first, so a moved element's copy shows its new text.
      const ordered = [...ops.filter((o) => o.type === "text"), ...ops.filter((o) => o.type !== "text")]
      for (const op of ordered) {
        if (op.type === "move") {
          const el = query(op.selector)
          if (!el) continue
          // A copy on the top layer: parents that clip overflow or stack lower cannot hide it. The original
          // keeps its place in the layout, invisible.
          const copy = floatingCopy(el, op.to)
          touch(el)
          el.style.visibility = "hidden"
          layer().appendChild(copy)
        } else if (op.type === "text") {
          const el = query(op.selector)
          const node = el && onlyText(el)
          if (!el || !node) continue
          const t = touch(el)
          t.text ??= { node, value: node.textContent ?? "" }
          node.textContent = op.after
        } else if (op.type === "block") {
          const box = document.createElement("div")
          const { x, y, width, height } = op.rect
          box.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${width}px;height:${height}px;background:${op.color};border-radius:8px;display:grid;place-items:center;font:500 13px system-ui;color:rgba(0,0,0,.6)`
          box.textContent = op.label ?? ""
          layer().appendChild(box)
        } else if (op.type === "component") {
          const frame = document.createElement("iframe")
          const { x, y, width, height } = op.rect
          frame.src = `${base}/frame.html?story=${encodeURIComponent(op.storyId)}&sb-shot=1`
          frame.title = op.title
          frame.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${width}px;height:${height}px;border:0;border-radius:8px;background:#fff;box-shadow:0 0 0 1.5px rgba(141,122,246,.9)`
          layer().appendChild(frame)
        } else if (op.type === "stroke") {
          svg.push(`<path d="${strokePath(op.points)}" stroke="${op.color}" stroke-width="${op.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
        }
      }
      if (svg.length) {
        const w = Math.max(document.documentElement.scrollWidth, innerWidth)
        const h = Math.max(document.documentElement.scrollHeight, innerHeight)
        const holder = document.createElement("div")
        holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="position:absolute;left:0;top:0;overflow:visible">${svg.join("")}</svg>`
        layer().appendChild(holder.firstElementChild!)
      }
    },
    at(clientX, clientY) {
      return describe(document.elementFromPoint(clientX, clientY))
    },
    parentOf(selector) {
      const el = query(selector)?.parentElement ?? null
      return describe(el)
    },
    find(selector) {
      return describe(query(selector))
    },
  }
  ;(window as unknown as { __stageboard_sketch?: SketchApi }).__stageboard_sketch = api
}
