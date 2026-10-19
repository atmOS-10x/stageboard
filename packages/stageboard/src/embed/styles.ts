import { pickCss, scopeCss } from "../client/css"
import { uiCss } from "../client/styles"

const SHARED = /\.sbu-(?:flows|flow(?:-[\w-]+)?|step(?:-[\w-]+)?|shot|thumb(?:-img)?|ref-[\w-]+|refs(?:-[\w-]+)?|viewer(?:-[\w-]+)?|b(?:-[\w-]+)?|dim|spacer|tnum)(?![\w-])/

const OVERRIDES = `
.sbu-embed-body { color: var(--foreground, #ededf0); font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
.sbu-embed-body * { box-sizing: border-box; }
.sbu-flows { position: static; overflow: visible; padding: 0; }
.sbu-flow { margin-bottom: 0; }
button.sbu-shot { padding: 0; border: 0; font: inherit; color: inherit; text-align: inherit; }
.sbu-flow-name, .sbu-viewer-title { color: var(--foreground, #f2f2f5); }
.sbu-flow-count, .sbu-viewer-count, .sbu-viewer-step-note { color: var(--muted-foreground, #8b8b96); }
.sbu-viewer { position: relative; inset: auto; z-index: auto; height: clamp(340px, calc(100vw * .48 + 150px), 760px); background: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; }
.sbu-viewer-head { padding: 4px 0 10px; }
.sbu-embed-body[data-mode="fullscreen"] { display: flex; flex-direction: column; }
.sbu-embed-body[data-mode="fullscreen"] .sbu-flows { flex: 1; overflow: auto; padding: 22px 28px; }
.sbu-embed-body[data-mode="fullscreen"] .sbu-viewer { flex: 1; height: auto; }
.sbu-embed-body[data-mode="fullscreen"] .sbu-viewer-head { padding: 18px 24px 10px; }
`

export function embedCss(rootId: string): string {
  return scopeCss(`${pickCss(uiCss, SHARED)}\n${OVERRIDES}`, `#${rootId}`)
}
