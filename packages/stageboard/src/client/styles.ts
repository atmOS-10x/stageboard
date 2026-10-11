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
.sbu-btn[data-on="true"] { border-color: #7c6cff; background: rgba(124,108,255,.14); color: #fff; }
.sbu-side { border-right: 1px solid rgba(255,255,255,.08); overflow: auto; background: #111114; padding: 10px 8px 24px; }
.sbu-search { width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.25); color: inherit; font: inherit; outline: none; margin-bottom: 10px; }
.sbu-search:focus { border-color: #7c6cff; }
.sbu-group { margin-top: 10px; }
.sbu-group-title { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #7d7d88; padding: 4px 8px; font-weight: 600; }
.sbu-comp { padding: 4px 8px; color: #c9c9d1; font-weight: 500; display: flex; align-items: center; gap: 6px; }
.sbu-story { display: block; width: 100%; text-align: left; border: 0; background: transparent; color: #a0a0aa; padding: 4px 8px 4px 22px; border-radius: 6px; font: inherit; cursor: pointer; }
.sbu-story:hover { background: rgba(255,255,255,.04); color: #fff; }
.sbu-story[data-on="true"] { background: rgba(124,108,255,.16); color: #fff; }
.sbu-badge { font-size: 10px; color: #b9a8ff; border: 1px solid rgba(124,108,255,.4); border-radius: 4px; padding: 0 4px; margin-left: 6px; }
.sbu-main { position: relative; overflow: hidden; background: #0b0b0d; }
.sbu-inspector { width: 380px; border-left: 1px solid rgba(255,255,255,.08); overflow: auto; background: #111114; }
.sbu-inspector:empty { display: none; }
.sbu-story-view { position: absolute; inset: 0; display: flex; flex-direction: column; }
.sbu-toolbar { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.06); }
.sbu-title { font-weight: 600; }
.sbu-dim { color: #8a8a95; }
.sbu-mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11.5px; }
.sbu-stage { flex: 1; overflow: auto; display: flex; justify-content: center; padding: 24px; background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px); background-size: 18px 18px; }
.sbu-frame { border: 0; background: #fff; border-radius: 10px; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 20px 50px rgba(0,0,0,.45); height: 100%; min-height: 400px; transition: width .2s ease; }
.sbu-empty { position: absolute; inset: 0; display: grid; place-items: center; color: #7d7d88; text-align: center; padding: 24px; }
.sbu-canvas { position: absolute; inset: 0; overflow: hidden; cursor: grab; background-color: #0b0b0d; background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px); }
.sbu-canvas[data-panning="true"] { cursor: grabbing; }
.sbu-world { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.sbu-node { position: absolute; border-radius: 12px; background: #16161b; box-shadow: 0 0 0 1px rgba(255,255,255,.09), 0 18px 40px rgba(0,0,0,.4); transition: box-shadow .2s ease; }
.sbu-node[data-focus="true"] { box-shadow: 0 0 0 2px #7c6cff, 0 18px 50px rgba(124,108,255,.25); }
.sbu-node[data-flash="true"] { box-shadow: 0 0 0 3px #3d9ff0, 0 0 60px rgba(61,159,240,.45); }
.sbu-node-head { height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 12px; cursor: move; user-select: none; border-bottom: 1px solid rgba(255,255,255,.07); }
.sbu-node-route { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #b9a8ff; }
.sbu-node-title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbu-node-body { position: relative; overflow: hidden; border-radius: 0 0 12px 12px; background: #fff; }
.sbu-node-body iframe { border: 0; transform-origin: 0 0; position: absolute; left: 0; top: 0; pointer-events: none; }
.sbu-node-body[data-live="true"] iframe { pointer-events: auto; }
.sbu-group-label { position: absolute; font-size: 28px; font-weight: 600; letter-spacing: -.01em; color: #a7a7b3; text-transform: capitalize; white-space: nowrap; pointer-events: none; }
.sbu-node-thumb { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; background: #f4f4f5; }
.sbu-node-shield { position: absolute; inset: 0; cursor: zoom-in; }
.sbu-edges { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
.sbu-edges path { fill: none; stroke: rgba(185,168,255,.45); stroke-width: 2; }
.sbu-edges path[data-hot="true"] { stroke: #3d9ff0; stroke-width: 3; }
.sbu-hud { position: absolute; left: 12px; bottom: 12px; display: flex; gap: 6px; align-items: center; background: rgba(18,18,22,.9); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 4px; }
.sbu-hud button { border: 0; background: transparent; color: #d0d0d8; padding: 4px 8px; border-radius: 6px; cursor: pointer; font: inherit; }
.sbu-hud button:hover { background: rgba(255,255,255,.07); }
.sbu-hint { position: absolute; right: 12px; bottom: 12px; color: #6f6f7a; font-size: 12px; }
`
