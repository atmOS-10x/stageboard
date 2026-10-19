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
@media (prefers-color-scheme: light) {
.sbu-embed-body { color: var(--foreground, #17171c); }
.sbu-flow-name, .sbu-viewer-title { color: var(--foreground, #17171c); }
.sbu-flow-count, .sbu-viewer-count, .sbu-viewer-step-note { color: var(--muted-foreground, #6b6b76); }
.sbu-shot, .sbu-viewer-slot { background: #f1f1f4; box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.05); }
.sbu-shot:hover { box-shadow: 0 0 0 1px rgba(124,108,255,.45), 0 2px 8px rgba(0,0,0,.08); }
.sbu-viewer-slot[data-current="true"] { box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 3px 10px rgba(0,0,0,.07); }
.sbu-step .sbu-shot[data-missing="true"], .sbu-viewer-missing, .sbu-ref-shot { background: #f1f1f4; }
.sbu-step-missing, .sbu-viewer-missing { color: #6b6b76; }
.sbu-ref-tag { background: rgba(255,255,255,.92); color: #3a3a44; box-shadow: 0 0 0 1px rgba(0,0,0,.08); }
.sbu-refs a, .sbu-refs li > span { background: rgba(0,0,0,.05); color: #3a3a44; }
.sbu-refs a:hover { background: rgba(0,0,0,.08); }
.sbu-refs img { box-shadow: 0 0 0 1px rgba(0,0,0,.1); }
.sbu-refs-app { color: var(--foreground, #17171c); }
.sbu-refs-caption { color: var(--muted-foreground, #6b6b76); }
.sbu-b { background: rgba(0,0,0,.06); color: #24242b; }
.sbu-b:hover:not(:disabled) { background: rgba(0,0,0,.1); }
.sbu-b[data-variant="ghost"]:not([data-on="true"]) { color: #55555f; }
.sbu-b[data-variant="ghost"]:not([data-on="true"]):hover:not(:disabled) { background: rgba(0,0,0,.06); color: #17171c; }
.sbu-b.sbu-viewer-nav { background: rgba(255,255,255,.94); color: #24242b; box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.14); }
.sbu-b.sbu-viewer-nav:hover { background: #fff; }
}
`

export function embedCss(rootId: string): string {
  return scopeCss(`${pickCss(uiCss, SHARED)}\n${OVERRIDES}`, `#${rootId}`)
}
