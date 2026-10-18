export const uiCss = `
html, body { margin: 0; height: 100%; }
body.sb-ui { background: #0e0e11; color: #ededf0; font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; overflow: hidden; }
.sbu { display: grid; grid-template-columns: 260px 1fr auto; grid-template-rows: 48px 1fr; height: 100vh; }
.sbu * { box-sizing: border-box; }
.sbu-top { grid-column: 1 / -1; display: flex; align-items: center; gap: 12px; padding: 0 14px; border-bottom: 1px solid rgba(255,255,255,.08); background: #121216; }
.sbu-brand { display: flex; align-items: center; gap: 8px; font-weight: 600; letter-spacing: -.01em; width: 232px; }
.sbu-tabs { display: inline-flex; background: rgba(255,255,255,.05); border-radius: 8px; padding: 2px; }
.sbu-tabs button { border: 0; background: transparent; color: #a0a0aa; padding: 5px 12px; border-radius: 6px; font: inherit; cursor: pointer; }
.sbu-tabs button[data-on="true"] { background: rgba(255,255,255,.1); color: #fff; }
.sbu-spacer { flex: 1; }
.sbu-btn { border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.03); color: #ededf0; padding: 5px 10px; border-radius: 7px; font: inherit; font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.sbu-btn:hover { border-color: rgba(255,255,255,.24); }
.sbu-btn[data-on="true"] { border-color: rgba(190,176,255,.38); background: rgba(190,176,255,.09); color: #fff; }
.sbu-btn svg { color: #9c9ca8; flex: none; }
.sbu-btn[data-on="true"] svg { color: #d4cbff; }
.sbu-key { font: 10.5px/15px ui-monospace, "SF Mono", Menlo, monospace; color: #7d7d88; border: 1px solid rgba(255,255,255,.1); border-radius: 4px; padding: 0 4px; }
.sbu-count { font-size: 11.5px; color: #8a8a95; font-variant-numeric: tabular-nums; }
.sbu-tool-gap { width: 4px; }
.sbu-side { border-right: 1px solid rgba(255,255,255,.08); overflow: auto; background: #111114; padding: 10px 8px 24px; }
.sbu-search { width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.25); color: inherit; font: inherit; outline: none; margin-bottom: 10px; }
.sbu-search:focus { border-color: #7c6cff; }
.sbu-group { margin-top: 10px; }
.sbu-group-title { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #7d7d88; padding: 4px 8px; font-weight: 600; }
.sbu-comp { padding: 4px 8px; color: #c9c9d1; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.sbu-story { display: block; width: 100%; text-align: left; border: 0; background: transparent; color: #a0a0aa; padding: 4px 8px 4px 22px; border-radius: 6px; font: inherit; cursor: pointer; }
.sbu-story:hover { background: rgba(255,255,255,.04); color: #fff; }
.sbu-story[data-on="true"] { background: rgba(124,108,255,.16); color: #fff; }
.sbu-badge { font-size: 10px; color: #7d7d88; border: 1px solid rgba(255,255,255,.1); border-radius: 4px; padding: 0 4px; margin-left: 6px; }
.sbu-main { position: relative; overflow: hidden; background: #0b0b0d; }
.sbu-inspector { width: 380px; border-left: 1px solid rgba(255,255,255,.08); overflow: auto; background: #111114; }
.sbu-inspector:empty { display: none; }
.sbu-story-view { position: absolute; inset: 0; display: flex; flex-direction: column; }
.sbu-toolbar { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.06); }
.sbu-title { font-weight: 600; }
.sbu-dim { color: #8a8a95; }
.sbu-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11.5px; }
.sbu-stage { flex: 1; overflow: auto; display: flex; justify-content: center; padding: 24px; background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px); background-size: 18px 18px; }
.sbu-frame-wrap { position: relative; height: 100%; min-height: 400px; max-width: 100%; transition: width .2s ease; }
.sbu-frame { display: block; width: 100%; border: 0; background: #fff; border-radius: 10px; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 20px 50px rgba(0,0,0,.45); height: 100%; }
.sbu-frame-wrap > .sbu-annot { border-radius: 10px; }
.sbu-stage[data-hidden="true"] { position: absolute; inset: 0; visibility: hidden; pointer-events: none; }
.sbu-empty { position: absolute; inset: 0; display: grid; place-items: center; color: #7d7d88; text-align: center; padding: 24px; }
.sbu-canvas { position: absolute; inset: 0; overflow: hidden; cursor: grab; user-select: none; background-color: #0b0b0d; background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px); }
.sbu-canvas[data-panning="true"] { cursor: grabbing; }
.sbu-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.sbu-node { position: absolute; border-radius: 12px; background: #16161b; box-shadow: 0 0 0 1px rgba(255,255,255,.09), 0 18px 40px rgba(0,0,0,.4); transition: box-shadow .2s ease; }
.sbu-node[data-focus="true"] { box-shadow: 0 0 0 calc(1.5px / var(--sbu-k, 1)) rgba(190,176,255,.7), 0 18px 50px rgba(124,108,255,.18); }
.sbu-node[data-flash="true"] { box-shadow: 0 0 0 3px #3d9ff0, 0 0 60px rgba(61,159,240,.45); }
.sbu-node-head { height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 12px; cursor: move; user-select: none; border-bottom: 1px solid rgba(255,255,255,.07); }
.sbu-node-route { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #b9a8ff; }
.sbu-node-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbu-node-body { position: relative; overflow: hidden; border-radius: 0 0 12px 12px; background: #fff; }
.sbu-node-body iframe { border: 0; transform-origin: 0 0; position: absolute; left: 0; top: 0; pointer-events: none; background: #fff; opacity: 0; transition: opacity .3s ease; }
.sbu-node-body iframe[data-ready="true"] { opacity: 1; }
.sbu-node-body[data-live="true"] iframe { pointer-events: auto; }
.sbu-group-label { position: absolute; font-size: 28px; font-weight: 600; letter-spacing: -.01em; color: #a7a7b3; text-transform: capitalize; white-space: nowrap; pointer-events: none; }
.sbu-node-shield { position: absolute; inset: 0; cursor: zoom-in; }
.sbu-edges { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.sbu-edges path { fill: none; stroke: rgba(185,168,255,.45); stroke-width: 2; }
.sbu-edges path[data-hot="true"] { stroke: #3d9ff0; stroke-width: 3; }
.sbu-hud { position: absolute; left: 12px; bottom: 12px; display: flex; gap: 6px; align-items: center; background: rgba(18,18,22,.9); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 4px; }
.sbu-hud button { border: 0; background: transparent; color: #d0d0d8; padding: 4px 8px; border-radius: 6px; cursor: pointer; font: inherit; }
.sbu-hud button:hover { background: rgba(255,255,255,.07); }
.sbu-hint { position: absolute; right: 12px; bottom: 12px; color: #6f6f7a; font-size: 12px; }


.sbu-thumb { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; background: #f2f2f4; isolation: isolate; pointer-events: none; }
.sbu-thumb[data-state="loading"] { background: linear-gradient(100deg, #eeeef1 30%, #f8f8fa 50%, #eeeef1 70%); background-size: 300% 100%; animation: sbu-shimmer 1.9s ease-in-out infinite; }
.sbu-thumb[data-state="error"] { z-index: 1; background: #f3f3f5; }
.sbu-thumb-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; animation: sbu-fade .28s ease both; }
.sbu-thumb-img[data-incoming="true"] { opacity: 0; animation: none; }
.sbu-thumb-note { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(calc(1 / max(var(--sbu-k, 1), .5))); display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #9a9aa4; white-space: nowrap; letter-spacing: .01em; z-index: 1; }
.sbu-thumb-note button { pointer-events: auto; border: 0; background: none; padding: 0; font: inherit; color: #5c5c67; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(92,92,103,.3); text-underline-offset: 3px; }
.sbu-thumb-note button:hover { color: #2c2c33; text-decoration-color: currentColor; }
@keyframes sbu-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@keyframes sbu-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sbu-rot { to { transform: rotate(360deg); } }

.sbu-annot { position: absolute; inset: 0; z-index: 3; pointer-events: none; container-type: size; }
.sbu-annot-layer { position: absolute; inset: 0; pointer-events: none; will-change: transform; }
.sbu-annot-catch { position: absolute; inset: 0; pointer-events: auto; cursor: crosshair; touch-action: none; border-radius: inherit; transition: box-shadow .15s ease; }
.sbu-annot-catch:hover { box-shadow: inset 0 0 0 calc(1px / var(--sbu-k, 1)) rgba(160,144,255,.45); }
.sbu-sel {
  position: absolute; pointer-events: none;
  border: calc(1.5px / var(--sbu-k, 1)) solid rgba(141,122,246,.92);
  border-radius: calc(6px / var(--sbu-k, 1));
  background: rgba(165,150,255,.16);
  box-shadow: 0 0 0 calc(3px / var(--sbu-k, 1)) rgba(165,150,255,.12);
}
.sbu-sel:not([data-drawing]):not([data-pin]) { animation: sbu-fade .16s ease-out both; }
.sbu-sel[data-pin] { border-style: dashed; background: rgba(165,150,255,.08); box-shadow: none; opacity: 0; transition: opacity .2s ease; }
.sbu-sel[data-pin="running"] { opacity: .55; }
.sbu-sel[data-pin][data-show="true"] { opacity: 1; }

.sbu-spin { width: 11px; height: 11px; border-radius: 999px; border: 1.5px solid rgba(255,255,255,.16); border-top-color: rgba(255,255,255,.72); animation: sbu-rot .9s linear infinite; flex: none; display: inline-block; box-sizing: border-box; }

.sbu-pin-anchor { position: absolute; width: 0; height: 0; }
.sbu-pin {
  position: absolute; left: 0; top: 0; transform-origin: 0 0;
  transform: translate(-10px, -50%); scale: calc(1 / max(var(--sbu-k, 1), .45));
  pointer-events: auto; display: inline-flex; align-items: center; gap: 6px;
  height: 24px; padding: 0 9px 0 7px; border-radius: 999px;
  background: rgba(22,22,27,.9); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.1); color: #d9d9e0;
  font-family: inherit; font-size: 11.5px; font-weight: 500; line-height: 1; white-space: nowrap;
  box-shadow: 0 6px 18px rgba(0,0,0,.3); cursor: pointer;
  animation: sbu-pin-in .26s cubic-bezier(.34,1.4,.64,1) both;
  transition: border-color .15s ease, background .15s ease;
}
.sbu-pin:hover, .sbu-pin[data-open="true"] { border-color: rgba(255,255,255,.22); background: rgba(28,28,34,.96); }
.sbu-pin svg { color: #a9a9b4; flex: none; }
.sbu-pin[data-status="failed"] svg, .sbu-pin[data-status="failed"] { color: #d8a899; }
.sbu-pin-dim { color: #85858f; font-weight: 400; }
.sbu-pin-hollow { width: 9px; height: 9px; border-radius: 999px; border: 1.5px solid #6f6f7a; box-sizing: border-box; }
.sbu-tnum { font-variant-numeric: tabular-nums; }
@keyframes sbu-pin-in { from { opacity: 0; translate: 0 4px; } to { opacity: 1; translate: 0 0; } }

.sbu-annot-hint {
  position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 5;
  display: inline-flex; align-items: center; gap: 10px; padding: 6px 7px 6px 13px; border-radius: 999px;
  background: rgba(22,22,27,.88); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.08); color: #a9a9b3; font-size: 12px; white-space: nowrap; pointer-events: none;
  box-shadow: 0 10px 30px rgba(0,0,0,.3); animation: sbu-rise .22s ease both;
}
@keyframes sbu-rise { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }

.sbu-float {
  position: fixed; left: 0; top: 0; z-index: 60; visibility: hidden; box-sizing: border-box;
  color: #ececf1; background: rgba(24,24,29,.94);
  -webkit-backdrop-filter: blur(18px) saturate(1.15); backdrop-filter: blur(18px) saturate(1.15);
  border: 1px solid rgba(255,255,255,.09); border-radius: 14px;
  box-shadow: 0 22px 50px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.05);
}
.sbu-float[data-placed="true"] { visibility: visible; animation: sbu-pop .16s cubic-bezier(.3,1.3,.6,1) both; }
.sbu-float[data-phase="leaving"] { animation: sbu-pop-out .14s cubic-bezier(.4,0,1,1) both; }
@keyframes sbu-pop { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
@keyframes sbu-pop-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: scale(.9); } }

.sbu-icon { width: 26px; height: 26px; display: inline-grid; place-items: center; flex: none; padding: 0; border: 0; border-radius: 7px; background: transparent; color: #85858f; cursor: pointer; transition: background .12s ease, color .12s ease; }
.sbu-icon:hover { background: rgba(255,255,255,.06); color: #d6d6dd; }
.sbu-icon:focus-visible, .sbu-seg button:focus-visible, .sbu-send:focus-visible, .sbu-ghost:focus-visible, .sbu-pin:focus-visible { outline: 1.5px solid rgba(190,176,255,.6); outline-offset: 1px; }

.sbu-composer { width: 360px; padding: 8px 8px 8px; display: flex; flex-direction: column; gap: 4px; }
.sbu-composer-ctx { display: flex; align-items: flex-start; gap: 4px; padding-left: 2px; }
.sbu-ctx-list { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; gap: 4px; padding-top: 1px; }
.sbu-composer-ctx .sbu-icon { width: 22px; height: 22px; }
.sbu-ctx {
  display: inline-flex; align-items: center; gap: 4px; flex: 0 1 auto; min-width: 0; height: 20px; max-width: 100%; padding: 0 7px; border-radius: 6px;
  background: rgba(255,255,255,.05); color: #9d9da8; font-size: 11.5px; white-space: nowrap; overflow: hidden;
  animation: sbu-fade .22s ease both;
}
.sbu-ctx svg { flex: none; color: #7f7f8a; }
.sbu-ctx > span { overflow: hidden; text-overflow: ellipsis; }
.sbu-ctx-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; color: #b9b9c3; }
.sbu-composer-input {
  display: block; width: 100%; min-height: 30px; max-height: 240px; margin: 2px 0 0; padding: 5px 6px;
  border: 0; outline: none; resize: none; background: transparent; color: #f2f2f5;
  font: inherit; font-size: 13.5px; line-height: 20px;
}
.sbu-composer-input::placeholder { color: #6c6c77; }
.sbu-composer-input:disabled { color: #a6a6b0; }
.sbu-composer-error { padding: 0 6px 2px; font-size: 12px; color: #d3a294; }
.sbu-composer-bar { display: flex; align-items: center; gap: 6px; padding-top: 2px; }
.sbu-seg { display: inline-flex; gap: 1px; padding: 2px; border-radius: 8px; background: rgba(255,255,255,.045); }
.sbu-seg button { height: 22px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: #8a8a95; font: inherit; font-size: 12px; cursor: pointer; transition: background .12s ease, color .12s ease; }
.sbu-seg button:hover { color: #d2d2da; }
.sbu-seg button[data-on="true"] { background: rgba(255,255,255,.1); color: #f3f3f6; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.sbu-seg-count button { width: 22px; padding: 0; font-variant-numeric: tabular-nums; }
.sbu-kbd-hint { font-size: 11px; color: #666671; animation: sbu-fade .2s ease both; }
.sbu-send { width: 28px; height: 28px; flex: none; display: inline-grid; place-items: center; padding: 0; border: 0; border-radius: 999px; background: #ebebf0; color: #17171c; cursor: pointer; transition: background .12s ease, opacity .15s ease, transform .12s ease; }
.sbu-send:hover:not(:disabled) { background: #fff; transform: translateY(-.5px); }
.sbu-send:disabled { opacity: .26; cursor: default; }
.sbu-send .sbu-spin { border-color: rgba(0,0,0,.14); border-top-color: rgba(0,0,0,.6); }
.sbu-drop { position: absolute; inset: 4px; display: grid; place-items: center; border-radius: 11px; border: 1.5px dashed rgba(190,176,255,.45); background: rgba(24,24,29,.88); color: #cdcdd6; font-size: 12.5px; pointer-events: none; animation: sbu-fade .12s ease both; }

.sbu-chips-img { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 6px 4px 2px; list-style: none; }
.sbu-imgchip { position: relative; display: block; width: 48px; height: 48px; border-radius: 9px; background: rgba(255,255,255,.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); animation: sbu-pop .16s cubic-bezier(.3,1.3,.6,1) both; }
.sbu-imgchip img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 9px; }
.sbu-imgchip[data-status="uploading"] img { opacity: .6; }
.sbu-imgchip[data-status="error"] img { opacity: .35; filter: grayscale(1); }
.sbu-imgchip-veil { position: absolute; inset: 0; display: grid; place-items: center; border: 0; border-radius: 9px; background: rgba(14,14,17,.35); color: #e4e4ea; font: inherit; font-size: 11px; cursor: pointer; padding: 0; }
.sbu-imgchip-x { position: absolute; top: -5px; right: -5px; width: 16px; height: 16px; display: grid; place-items: center; padding: 0; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: #25252c; color: #b3b3bd; cursor: pointer; opacity: 0; transition: opacity .12s ease; }
.sbu-imgchip:hover .sbu-imgchip-x, .sbu-imgchip-x:focus-visible { opacity: 1; }

.sbu-details { width: 320px; padding: 10px 12px; display: flex; flex-direction: column; gap: 9px; }
.sbu-details-head { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #cfcfd7; }
.sbu-details-head svg { color: #a9a9b4; }
.sbu-details-head .sbu-icon { width: 22px; height: 22px; margin: -2px -4px -2px 0; }
.sbu-details-note { margin: 0; max-height: 9em; overflow: auto; font-size: 13px; line-height: 1.5; color: #ededf1; white-space: pre-wrap; }
.sbu-details .sbu-chips-img { padding: 0; }
.sbu-log { margin: 0; max-height: 112px; overflow: auto; padding: 8px 9px; border-radius: 8px; background: rgba(0,0,0,.26); color: #8b8b96; font: 10.5px/1.55 ui-monospace, "SF Mono", Menlo, monospace; white-space: pre-wrap; word-break: break-word; }
.sbu-details-foot { display: flex; align-items: center; gap: 6px; }
.sbu-ghost { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border: 0; border-radius: 7px; background: rgba(255,255,255,.05); color: #d3d3da; font: inherit; font-size: 12px; text-decoration: none; cursor: pointer; transition: background .12s ease, color .12s ease; }
.sbu-ghost:hover { background: rgba(255,255,255,.09); color: #fff; }
.sbu-ghost:disabled { opacity: .5; cursor: default; }
.sbu-ghost-sm { height: 22px; padding: 0 9px; font-size: 11.5px; }

.sbu-gallery { flex: 1; overflow: auto; padding: 22px 24px 56px; display: flex; flex-direction: column; gap: 34px; }
.sbu-row-head { display: flex; align-items: baseline; gap: 10px; margin: 0 2px 12px; }
.sbu-row-id { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: #d0d0d8; }
.sbu-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 22px 18px; }
.sbu-card { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sbu-card-shot { position: relative; aspect-ratio: 1440 / 900; border-radius: 10px; background: #f2f2f4; box-shadow: 0 0 0 1px rgba(255,255,255,.07), 0 10px 28px rgba(0,0,0,.35); transition: box-shadow .2s ease; }
.sbu-card[data-on="true"] .sbu-card-shot { box-shadow: 0 0 0 1.5px rgba(190,176,255,.62), 0 10px 28px rgba(0,0,0,.35); }
.sbu-card-shot > .sbu-annot { border-radius: 10px; }
.sbu-card-meta { padding: 0 2px; }
.sbu-card-line { display: flex; align-items: center; gap: 8px; min-height: 22px; }
.sbu-card-label { font-size: 13px; font-weight: 500; color: #ececf1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbu-card-inuse { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: #aaa4cf; }
.sbu-card-desc { margin: 3px 0 0; font-size: 12px; line-height: 1.45; color: #85858f; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sbu-gallery-empty { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 24px; color: #7d7d88; text-align: center; }
.sbu-gallery-empty p { margin: 4px 0; max-width: 360px; }
.sbu-gallery-empty-title { color: #d8d8df; font-size: 14px; }

@media (prefers-reduced-motion: reduce) {
  .sbu-thumb[data-state="loading"] { animation: none; }
  .sbu-spin { animation-duration: 2.4s; }
  .sbu-float[data-placed="true"], .sbu-float[data-phase="leaving"], .sbu-pin, .sbu-imgchip, .sbu-sel, .sbu-ctx, .sbu-annot-hint, .sbu-thumb-img, .sbu-drop, .sbu-kbd-hint { animation: none; }
  .sbu-frame-wrap, .sbu-node-body iframe, .sbu-sel[data-pin] { transition: none; }
}
`
