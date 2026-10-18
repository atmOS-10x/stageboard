export const devtoolsCss = `
:host { all: initial; }
* { box-sizing: border-box; }
.sb-root {
  --sb-bg: rgba(18, 18, 22, 0.92);
  --sb-bg-solid: #141418;
  --sb-fg: #f4f4f6;
  --sb-muted: #9b9ba6;
  --sb-line: rgba(255, 255, 255, 0.09);
  --sb-line-strong: rgba(255, 255, 255, 0.16);
  --sb-accent: #7c6cff;
  --sb-accent-2: #3d9ff0;
  --sb-ok: #2fb585;
  --sb-warn: #f0b429;
  --sb-err: #ef6f4f;
  font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--sb-fg);
  -webkit-font-smoothing: antialiased;
}
.sb-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
.sb-mono { font-family: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; font-size: 11.5px; }

.sb-bubble {
  position: fixed; right: 18px; bottom: 18px; z-index: 2147483647;
  height: 40px; min-width: 40px; padding: 0 12px 0 10px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--sb-bg); color: var(--sb-fg);
  border: 1px solid var(--sb-line-strong);
  box-shadow: 0 8px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  cursor: pointer; pointer-events: auto; user-select: none;
  transition: transform .15s ease, border-color .15s ease;
  font: inherit;
}
.sb-bubble:hover { transform: translateY(-1px); border-color: rgba(255,255,255,.28); }
.sb-bubble[data-active="true"] { border-color: var(--sb-accent); }
.sb-bubble .sb-label { font-weight: 500; font-size: 12.5px; }
.sb-bubble .sb-count { font-size: 11px; color: var(--sb-muted); }
.sb-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--sb-muted); flex: none; }
.sb-dot[data-on="true"] { background: var(--sb-ok); box-shadow: 0 0 0 3px rgba(47,181,133,.18); }
.sb-mark { width: 18px; height: 18px; flex: none; }

.sb-hover {
  position: fixed; pointer-events: none; border-radius: 4px;
  outline: 1.5px solid var(--sb-accent-2); outline-offset: 0;
  background: rgba(61,159,240,.08);
  transition: all .06s linear;
}
.sb-hover-label {
  position: fixed; pointer-events: none; padding: 3px 7px; border-radius: 6px;
  background: var(--sb-accent-2); color: #fff; font-size: 11.5px; font-weight: 500; white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0,0,0,.25);
}
.sb-hover-label .sb-dim { opacity: .75; font-weight: 400; margin-left: 6px; }
.sb-selected { position: fixed; pointer-events: none; border-radius: 4px; outline: 2px solid var(--sb-accent); outline-offset: 1px; }

.sb-job { position: fixed; pointer-events: none; border-radius: 10px; }
.sb-job::before {
  content: ""; position: absolute; inset: 0; border-radius: 10px; padding: 2px;
  background: conic-gradient(from var(--sb-angle, 0deg), #7c6cff, #3d9ff0, #2fb585, #f0b429, #ec5f98, #7c6cff);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
  animation: sb-spin 2.6s linear infinite;
}
.sb-job::after {
  content: ""; position: absolute; inset: 0; border-radius: 10px; overflow: hidden;
  background: linear-gradient(105deg, transparent 30%, rgba(124,108,255,.10) 45%, rgba(61,159,240,.16) 50%, rgba(124,108,255,.10) 55%, transparent 70%);
  background-size: 250% 100%;
  animation: sb-sweep 2.2s ease-in-out infinite;
}
.sb-job-pill {
  position: absolute; top: -14px; left: 12px; z-index: 1;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 4px 10px 4px 8px; border-radius: 999px;
  background: var(--sb-bg-solid); border: 1px solid var(--sb-line-strong); color: var(--sb-fg);
  font-size: 11.5px; font-weight: 500; white-space: nowrap;
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
}
.sb-job[data-inside="true"] .sb-job-pill { top: 10px; }
.sb-spinner { width: 12px; height: 12px; border-radius: 999px; border: 1.5px solid rgba(255,255,255,.2); border-top-color: #fff; animation: sb-rot .8s linear infinite; flex: none; }
@keyframes sb-spin { to { --sb-angle: 360deg; } }
@keyframes sb-sweep { 0% { background-position: 130% 0; } 100% { background-position: -30% 0; } }
@keyframes sb-rot { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .sb-job::before, .sb-job::after, .sb-spinner { animation-duration: 0s; animation-iteration-count: 1; }
}

.sb-panel {
  position: fixed; right: 18px; bottom: 68px; z-index: 2147483647; width: 360px; max-height: calc(100vh - 100px);
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--sb-bg); border: 1px solid var(--sb-line-strong); border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
  pointer-events: auto;
}
.sb-panel[data-docked="false"] { position: relative; right: auto; bottom: auto; width: 100%; max-height: none; box-shadow: none; }
.sb-sec { padding: 12px 14px; border-top: 1px solid var(--sb-line); }
.sb-sec:first-child { border-top: 0; }
.sb-scroll { overflow: auto; }
.sb-title { font-size: 15px; font-weight: 600; letter-spacing: -.01em; display: flex; align-items: center; gap: 8px; }
.sb-sub { color: var(--sb-muted); font-size: 12px; margin-top: 2px; word-break: break-all; }
.sb-crumbs { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.sb-crumb { border: 1px solid var(--sb-line); background: transparent; color: var(--sb-muted); border-radius: 6px; padding: 1px 6px; font: inherit; font-size: 11.5px; cursor: pointer; }
.sb-crumb:hover { color: var(--sb-fg); border-color: var(--sb-line-strong); }
.sb-crumb[data-on="true"] { color: var(--sb-fg); border-color: var(--sb-accent); background: rgba(124,108,255,.12); }
.sb-h { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--sb-muted); font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
.sb-variants { display: grid; gap: 6px; }
.sb-variant {
  display: flex; gap: 10px; align-items: flex-start; text-align: left; width: 100%;
  padding: 8px 10px; border-radius: 9px; border: 1px solid var(--sb-line); background: rgba(255,255,255,.02);
  color: var(--sb-fg); font: inherit; cursor: pointer; position: relative; overflow: hidden;
}
.sb-variant:hover { border-color: var(--sb-line-strong); background: rgba(255,255,255,.04); }
.sb-variant[data-on="true"] { border-color: var(--sb-accent); background: rgba(124,108,255,.10); }
.sb-variant .sb-radio { width: 14px; height: 14px; border-radius: 999px; border: 1.5px solid var(--sb-line-strong); margin-top: 2px; flex: none; }
.sb-variant[data-on="true"] .sb-radio { border: 4px solid var(--sb-accent); }
.sb-variant .sb-vl { font-weight: 500; }
.sb-variant .sb-vd { color: var(--sb-muted); font-size: 12px; }
.sb-variant[data-pending="true"] { cursor: default; color: var(--sb-muted); }
.sb-variant[data-pending="true"]::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(124,108,255,.14) 50%, transparent 70%);
  background-size: 250% 100%; animation: sb-sweep 1.8s ease-in-out infinite;
}
.sb-textarea {
  width: 100%; min-height: 76px; resize: vertical; padding: 9px 10px; border-radius: 9px;
  background: rgba(0,0,0,.25); border: 1px solid var(--sb-line-strong); color: var(--sb-fg); font: inherit; outline: none;
}
.sb-textarea:focus { border-color: var(--sb-accent); box-shadow: 0 0 0 3px rgba(124,108,255,.2); }
.sb-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.sb-seg { display: inline-flex; border: 1px solid var(--sb-line-strong); border-radius: 8px; overflow: hidden; }
.sb-seg button { background: transparent; border: 0; color: var(--sb-muted); padding: 5px 9px; font: inherit; font-size: 12px; cursor: pointer; }
.sb-seg button[data-on="true"] { background: rgba(255,255,255,.08); color: var(--sb-fg); }
.sb-btn {
  margin-left: auto; display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(180deg, #8a7cff, #6a5af0); color: #fff; border: 0; border-radius: 8px;
  padding: 6px 12px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer;
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 4px 14px rgba(106,90,240,.35);
}
.sb-btn:disabled { opacity: .5; cursor: not-allowed; }
.sb-btn-ghost { background: transparent; border: 1px solid var(--sb-line-strong); color: var(--sb-fg); border-radius: 7px; padding: 3px 8px; font: inherit; font-size: 12px; cursor: pointer; }
.sb-btn-ghost:hover { border-color: rgba(255,255,255,.3); }
.sb-icon-btn { margin-left: auto; background: transparent; border: 0; color: var(--sb-muted); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; }
.sb-icon-btn:hover { color: var(--sb-fg); }
.sb-job-row { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 6px 0; border-top: 1px dashed var(--sb-line); }
.sb-job-row:first-child { border-top: 0; }
.sb-status { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
.sb-status[data-s="running"], .sb-status[data-s="queued"] { color: var(--sb-accent-2); }
.sb-status[data-s="done"] { color: var(--sb-ok); }
.sb-status[data-s="failed"] { color: var(--sb-err); }
.sb-status[data-s="cancelled"] { color: var(--sb-muted); }
.sb-note { color: var(--sb-muted); font-size: 12px; }
.sb-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
a.sb-link { color: var(--sb-accent-2); text-decoration: none; }
a.sb-link:hover { text-decoration: underline; }
.sb-kbd { font-size: 10.5px; color: var(--sb-muted); border: 1px solid var(--sb-line); border-radius: 4px; padding: 0 4px; }

/* The stageboard UI kit: pill buttons, one segmented control, one panel, normal-case labels. */
.sb-root { --sb-bg: #1b1a22; --sb-bg-solid: #1b1a22; --sb-line: rgba(255,255,255,.08); --sb-line-strong: rgba(255,255,255,.1); --sb-accent: #8d7af6; --sb-accent-2: #8d7af6; }
.sb-bubble { height: 40px; padding: 0 14px 0 12px; background: rgba(27,26,34,.94); border: 1px solid rgba(255,255,255,.1); box-shadow: 0 12px 32px rgba(0,0,0,.4); }
.sb-bubble:hover { transform: none; background: rgba(40,39,48,.96); border-color: rgba(255,255,255,.14); }
.sb-bubble[data-active="true"] { background: #ebebf0; color: #16161b; border-color: transparent; }
.sb-bubble[data-active="true"] .sb-count { color: #55555e; }
.sb-hover { outline-color: #8d7af6; background: rgba(141,122,246,.08); }
.sb-hover-label { background: #8d7af6; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; }
.sb-panel { background: #1b1a22; border: 1px solid rgba(255,255,255,.09); border-radius: 16px; box-shadow: 0 18px 48px rgba(0,0,0,.5); backdrop-filter: none; -webkit-backdrop-filter: none; }
.sb-panel[data-docked="false"] { border-radius: 0; border: 0; }
.sb-sec { padding: 14px 16px; border-top-color: rgba(255,255,255,.06); }
.sb-title { font-size: 15px; font-weight: 500; }
.sb-h { font-size: 12.5px; text-transform: none; letter-spacing: 0; font-weight: 500; color: #9a9aa5; }
.sb-crumb { height: 24px; padding: 0 10px; border: 0; border-radius: 999px; background: rgba(255,255,255,.07); color: #b4b4be; font-size: 11.5px; }
.sb-crumb:hover { background: rgba(255,255,255,.12); color: #f2f2f5; }
.sb-crumb[data-on="true"] { background: #ebebf0; color: #16161b; border: 0; }
.sb-variant { border: 0; border-radius: 10px; background: transparent; padding: 9px 10px; }
.sb-variant:hover { background: rgba(255,255,255,.06); border: 0; }
.sb-variant[data-on="true"] { background: rgba(245,200,75,.12); border: 0; }
.sb-variant .sb-radio { border-color: rgba(255,255,255,.25); }
.sb-variant[data-on="true"] .sb-radio { border-color: #f5c84b; }
.sb-textarea { min-height: 72px; padding: 10px 12px; border: 0; border-radius: 12px; background: rgba(255,255,255,.05); font-size: 13.5px; line-height: 1.45; resize: none; }
.sb-textarea::placeholder { color: #7e7e89; }
.sb-textarea:focus { border: 0; box-shadow: 0 0 0 2px rgba(190,176,255,.45); }
.sb-row { gap: 6px; margin-top: 10px; }
.sb-seg { gap: 2px; padding: 2px; border: 0; border-radius: 999px; background: rgba(255,255,255,.06); overflow: visible; }
.sb-seg button { height: 22px; padding: 0 9px; border-radius: 999px; color: #9a9aa5; font-weight: 500; }
.sb-seg button:hover { color: #e6e6ec; }
.sb-seg button[data-on="true"] { background: rgba(255,255,255,.14); color: #fff; }
.sb-btn { height: 30px; padding: 0 14px; border-radius: 999px; background: #ebebf0; color: #16161b; font-weight: 500; box-shadow: none; }
.sb-btn:hover:not(:disabled) { background: #fff; }
.sb-btn:disabled { opacity: .35; cursor: default; }
.sb-btn-ghost { height: 24px; padding: 0 10px; border: 0; border-radius: 999px; background: rgba(255,255,255,.08); font-weight: 500; }
.sb-btn-ghost:hover { background: rgba(255,255,255,.13); }
.sb-icon-btn { width: 26px; height: 26px; display: inline-grid; place-items: center; padding: 0; border-radius: 999px; font-size: 15px; }
.sb-icon-btn:hover { background: rgba(255,255,255,.07); }
.sb-status { font-size: 11.5px; text-transform: none; letter-spacing: 0; font-weight: 500; }
.sb-status[data-s="running"], .sb-status[data-s="queued"] { color: #b9b0e8; }
.sb-job-row { border-top: 1px solid rgba(255,255,255,.05); }
a.sb-link { color: #b4add8; text-decoration: underline; text-decoration-color: rgba(180,173,216,.35); text-underline-offset: 3px; }
.sb-chip { height: 26px; padding: 0 11px; border: 0; border-radius: 999px; background: rgba(255,255,255,.08); font-weight: 500; }
.sb-chip:hover { background: rgba(255,255,255,.13); border: 0; }
.sb-job-pill { background: #1b1a22; border-color: rgba(255,255,255,.1); }
.sb-b:focus-visible, .sb-btn:focus-visible, .sb-btn-ghost:focus-visible, .sb-seg button:focus-visible, .sb-crumb:focus-visible, .sb-chip:focus-visible, .sb-bubble:focus-visible { outline: 2px solid rgba(190,176,255,.7); outline-offset: 2px; }
`
