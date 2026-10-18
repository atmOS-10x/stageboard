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
.sbu-devices button { font-size: 12px; }
.sbu-browse, .sbu-flows { position: absolute; inset: 0; overflow: auto; padding: 22px 28px 60px; --step-w: 300px; --ratio: .625; }
.sbu-browse[data-device="tablet"], .sbu-flows[data-device="tablet"] { --step-w: 210px; --ratio: 1.4317; }
.sbu-browse[data-device="mobile"], .sbu-flows[data-device="mobile"] { --step-w: 170px; --ratio: 2.1641; }
.sbu-browse-section { margin-bottom: 34px; }
.sbu-browse-title { margin: 0 0 14px; font-size: 15px; font-weight: 500; color: #ededf0; display: flex; gap: 8px; align-items: baseline; }
.sbu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--step-w), 1fr)); gap: 26px 22px; }
.sbu-card-screen { min-width: 0; animation: sbu-rise .25s ease both; }
.sbu-shot { position: relative; display: block; width: 100%; overflow: hidden; border-radius: 10px; background: #fff; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 12px 30px rgba(0,0,0,.35); cursor: pointer; container-type: inline-size; transition: box-shadow .15s ease, transform .15s ease; }
.sbu-shot:hover { box-shadow: 0 0 0 1px rgba(190,176,255,.45), 0 16px 36px rgba(0,0,0,.45); }
.sbu-shot > .sbu-annot { border-radius: inherit; }
.sbu-card-caption { display: flex; align-items: center; gap: 8px; margin-top: 9px; min-width: 0; }
.sbu-card-title { font-size: 13px; font-weight: 500; color: #ececf1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbu-card-sub { margin-left: auto; font: 11.5px ui-monospace, Menlo, monospace; color: #7d7d88; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbu-flows-head { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
.sbu-flows-head h1 { margin: 0; font-size: 18px; font-weight: 500; }
.sbu-flows-hero { display: grid; place-items: center; min-height: calc(100% - 80px); }
.sbu-flows-hero-card { position: relative; width: min(560px, 100%); aspect-ratio: 16 / 10; border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px rgba(150,132,255,.25), 0 30px 80px rgba(0,0,0,.5); }
.sbu-flow-row { gap: 18px; }
.sbu-flow-foot { margin-top: 6px; }
.sbu-flow-foot .sbu-flow-name { font-size: 17px; }
.sbu-flow-count { display: flex; align-items: center; gap: 12px; margin-top: 3px; font-size: 13.5px; color: #8b8b96; }
.sbu-flow-delete { opacity: 0; transition: opacity .12s ease; }
.sbu-flow:hover .sbu-flow-delete { opacity: 1; }
.sbu-link { border: 0; background: none; padding: 0; color: #b4add8; font: inherit; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(180,173,216,.35); text-underline-offset: 3px; }
.sbu-step-add { width: calc(var(--step-w) * .35); opacity: 0; transition: opacity .15s ease; }
.sbu-flow:hover .sbu-step-add, .sbu-flow-cell[data-over="true"] .sbu-step-add { opacity: 1; }
.sbu-step-add .sbu-add-shot { height: calc(var(--step-w) * var(--ratio)); aspect-ratio: auto !important; }
.sbu-viewer { position: fixed; inset: 0; z-index: 50; display: flex; flex-direction: column; background: rgba(12,12,15,.97); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); animation: sbu-fade .18s ease both; }
.sbu-viewer-head { display: flex; align-items: center; gap: 12px; padding: 18px 24px 10px; }
.sbu-viewer-title { margin: 0; font-size: 20px; font-weight: 500; color: #f4f4f7; }
.sbu-viewer-count { font-size: 13px; color: #8b8b96; }
.sbu-viewer-round { width: 36px; height: 36px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 999px; background: rgba(255,255,255,.08); color: #e6e6ec; cursor: pointer; }
.sbu-viewer-round:hover { background: rgba(255,255,255,.14); }
.sbu-viewer-stage { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 6px 0; }
.sbu-viewer-track { position: relative; width: 100%; }
.sbu-viewer-slot { position: absolute; left: 50%; top: 0; border-radius: 12px; overflow: hidden; background: #16151e; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 30px 80px rgba(0,0,0,.55); opacity: .42; cursor: pointer; transition: transform .32s cubic-bezier(.32,.72,0,1), opacity .25s ease; }
.sbu-viewer-slot[data-current="true"] { opacity: 1; cursor: default; z-index: 2; }
.sbu-viewer-slot:not([data-current="true"]) .sbu-viewer-scale { pointer-events: none; }
.sbu-viewer-slot:not([data-current="true"]):hover { opacity: .65; }
.sbu-viewer-loading { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; background: #16151e; animation: sbu-fade .15s ease both; }
.sbu-viewer-nav { position: absolute; left: 50%; top: 50%; z-index: 4; width: 52px; height: 52px; margin-top: -26px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 999px; background: rgba(28,28,34,.82); color: #fff; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.4); transition: background .12s ease; }
.sbu-viewer-nav:hover { background: rgba(48,48,56,.92); }
.sbu-viewer-tools { min-height: 54px; display: flex; align-items: center; justify-content: center; padding-top: 10px; }
.sbu-viewer-hint { display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px; border-radius: 999px; background: rgba(28,28,34,.9); border: 1px solid rgba(255,255,255,.08); color: #b9b9c3; font-size: 12.5px; animation: sbu-rise .2s ease both; }
.sbu-sketch-bar[data-docked="true"] { position: static; translate: none; }
.sbu-viewer-scale { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.sbu-viewer-frame { display: block; width: 100%; height: 100%; border: 0; background: #fff; }
.sbu-viewer-scale > .sbu-annot, .sbu-viewer-scale > .sbu-sketch { border-radius: 0; }
.sbu-viewer-missing { position: absolute; inset: 0; display: grid; place-items: center; background: #17161e; color: #a8a2c8; font-size: 14px; }
.sbu-viewer-foot { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 12px; padding: 12px 24px 22px; }
.sbu-viewer-device { font-size: 13px; color: #7e7e89; align-self: center; }
.sbu-viewer-actions { display: flex; gap: 10px; }
.sbu-viewer-pill { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 20px; border: 0; border-radius: 999px; background: rgba(255,255,255,.1); color: #f0f0f4; font: inherit; font-size: 14.5px; font-weight: 500; cursor: pointer; transition: background .12s ease; }
.sbu-viewer-pill:hover:not(:disabled) { background: rgba(255,255,255,.16); }
.sbu-viewer-pill[data-on="true"] { background: #ebebf0; color: #16161b; }
.sbu-viewer-pill[data-on="true"]:hover:not(:disabled) { background: #fff; }
.sbu-viewer-pill:focus { outline: none; }
.sbu-viewer-pill:focus-visible, .sbu-viewer-nav:focus-visible, .sbu-viewer-round:focus-visible { outline: 2px solid rgba(190,176,255,.7); outline-offset: 2px; }
.sbu-viewer-pill[data-on="true"] .sbu-key { color: #55555e; border-color: rgba(0,0,0,.15); }
.sbu-viewer-pill[data-quiet="true"] { background: transparent; color: #b8b8c2; }
.sbu-viewer-pill:disabled { opacity: .4; cursor: default; }
.sbu-viewer-info { position: relative; justify-self: end; }
.sbu-viewer-more { border: 0; background: none; color: #f0f0f4; font: inherit; font-size: 14.5px; font-weight: 500; cursor: pointer; padding: 8px 2px; }
.sbu-viewer-popover { position: absolute; right: 0; bottom: calc(100% + 10px); width: 360px; display: flex; flex-direction: column; gap: 10px; padding: 18px; border-radius: 18px; background: rgba(40,40,46,.97); box-shadow: 0 20px 60px rgba(0,0,0,.55); animation: sbu-composer-in .2s cubic-bezier(.32,.72,0,1) both; }
.sbu-viewer-pop-row { display: flex; gap: 28px; }
.sbu-viewer-pop-label { font-size: 13px; color: #9a9aa5; }
.sbu-viewer-pop-value { margin-top: 2px; font-size: 16px; font-weight: 500; color: #f4f4f7; }
.sbu-viewer-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.sbu-viewer-chip { height: 34px; padding: 0 14px; border: 0; border-radius: 10px; background: rgba(255,255,255,.08); color: #ececf1; font: inherit; font-size: 13.5px; cursor: pointer; }
.sbu-viewer-chip:hover { background: rgba(255,255,255,.15); }
.sbu-picker-scrim { position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 32px; background: rgba(6,6,9,.6); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); animation: sbu-fade .15s ease both; }
.sbu-picker { width: min(1040px, 100%); max-height: min(780px, 100%); display: flex; flex-direction: column; border-radius: 20px; background: #17171c; border: 1px solid rgba(255,255,255,.09); box-shadow: 0 30px 90px rgba(0,0,0,.6); overflow: hidden; animation: sbu-composer-in .22s cubic-bezier(.32,.72,0,1) both; --pick-w: 210px; }
.sbu-picker[data-device="tablet"] { --pick-w: 150px; }
.sbu-picker[data-device="mobile"] { --pick-w: 120px; }
.sbu-picker-head { display: flex; align-items: center; gap: 12px; padding: 14px 14px 12px 18px; border-bottom: 1px solid rgba(255,255,255,.07); }
.sbu-picker-search { flex: 1; height: 44px; padding: 0 14px; border: 0; border-radius: 12px; background: rgba(255,255,255,.06); color: #f4f4f7; font: inherit; font-size: 16px; outline: none; }
.sbu-picker-search:focus { box-shadow: 0 0 0 2px rgba(190,176,255,.45); }
.sbu-picker-title { flex: 1; font-size: 16px; font-weight: 500; color: #f4f4f7; }
.sbu-picker-body { overflow-y: auto; padding: 16px 18px 24px; display: flex; flex-direction: column; gap: 20px; }
.sbu-picker-group h3 { margin: 0 0 10px; font-size: 12px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: #8b8b96; }
.sbu-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--pick-w), 1fr)); gap: 16px 14px; }
.sbu-picker-item, .sbu-picker-new { display: flex; flex-direction: column; gap: 8px; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; min-width: 0; }
.sbu-picker-item .sbu-shot { pointer-events: none; }
.sbu-picker-item:hover .sbu-shot, .sbu-picker-item:focus-visible .sbu-shot { box-shadow: 0 0 0 2px #8d7af6, 0 16px 36px rgba(0,0,0,.45); }
.sbu-picker-name { font-size: 13px; color: #dcdce3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbu-picker-new { width: var(--pick-w); }
.sbu-picker-new-shot { position: relative; display: grid; place-items: center; width: 100%; border-radius: 10px; overflow: hidden; color: #fff; box-shadow: 0 0 0 1px rgba(150,132,255,.35); }
.sbu-picker-new-shot > svg { position: relative; z-index: 1; padding: 10px; box-sizing: content-box; border-radius: 999px; background: rgba(20,19,28,.75); }
.sbu-picker-new:hover .sbu-picker-new-shot { box-shadow: 0 0 0 2px #8d7af6; }
.sbu-picker-describe { display: flex; flex-direction: column; gap: 8px; padding: 16px 18px 18px; }
.sbu-picker-prompt { min-height: 140px; resize: vertical; padding: 12px 14px; border: 0; border-radius: 12px; background: rgba(255,255,255,.05); color: #f4f4f7; font: inherit; font-size: 15px; line-height: 1.5; outline: none; }
.sbu-picker-prompt:focus { box-shadow: 0 0 0 2px rgba(190,176,255,.45); }
.sbu-flows-hero-card[data-busy="false"] .sbu-waves { opacity: .35; }
.sbu-flows-hero-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 32px 40px; text-align: center; color: #c9c5df; font-size: 13.5px; line-height: 1.55; background: radial-gradient(ellipse at center, rgba(14,13,20,.82) 0%, rgba(14,13,20,.55) 60%, rgba(14,13,20,.2) 100%); }
.sbu-flows-hero-text p { margin: 0; max-width: 400px; }
.sbu-flows-hero-title { font-size: 19px; font-weight: 500; color: #f4f2ff; }
.sbu-flows-hero-log { font: 12px/1.5 ui-monospace, Menlo, monospace; color: #a9a3cb; max-width: 440px !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbu-flows-hero-go { margin-top: 8px; height: 38px; padding: 0 20px; border: 0; border-radius: 12px; background: #ebebf0; color: #17171c; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.35); }
.sbu-flows-hero-go:hover { background: #fff; }
.sbu-flows-hero-alt { border: 0; background: none; color: #b4add8; font: inherit; font-size: 12.5px; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(180,173,216,.35); text-underline-offset: 3px; }
.sbu-toasts { position: fixed; right: 16px; bottom: 16px; z-index: 90; display: flex; flex-direction: column; gap: 8px; width: min(420px, calc(100vw - 32px)); }
.sbu-toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 10px 12px 14px; border-radius: 14px; background: #1b1a22; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 18px 48px rgba(0,0,0,.5); color: #ececf1; animation: sbu-composer-in .22s cubic-bezier(.32,.72,0,1) both; }
.sbu-toast[data-tone="error"] { border-color: rgba(226,150,130,.35); }
.sbu-toast[data-tone="error"] > svg { flex: none; margin-top: 2px; color: #eaa48f; }
.sbu-toast-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.sbu-toast-title { font-size: 13px; font-weight: 500; }
.sbu-toast-body { font: 12px/1.5 ui-monospace, Menlo, monospace; color: #c4bfd0; word-break: break-word; max-height: 7.5em; overflow: auto; }
.sbu-toast-actions { display: flex; gap: 6px; margin-top: 4px; }
.sbu-flow { margin-bottom: 40px; scroll-margin-top: 16px; }
.sbu-flow[data-focus="true"] .sbu-flow-name { color: #d4cbff; }
.sbu-flow-name { margin: 0; font-size: 16px; font-weight: 500; color: #f2f2f5; cursor: text; }
.sbu-flow-rename { font: inherit; font-size: 16px; font-weight: 500; color: #fff; background: rgba(255,255,255,.06); border: 0; border-radius: 6px; padding: 2px 6px; outline: 1.5px solid rgba(190,176,255,.5); }
.sbu-flow-row { display: flex; align-items: flex-start; overflow-x: auto; padding: 8px 2px 14px; }
.sbu-flow-cell { position: relative; display: flex; align-items: flex-start; flex: none; }
.sbu-flow-cell[data-over="true"]::before { content: ""; position: absolute; left: -2px; top: 0; height: calc(var(--step-w) * var(--ratio)); width: 3px; border-radius: 2px; background: #8d7af6; box-shadow: 0 0 12px rgba(141,122,246,.8); }
.sbu-step { position: relative; width: var(--step-w); flex: none; }
.sbu-step .sbu-shot { cursor: pointer; }
.sbu-step .sbu-shot[data-missing="true"] { background: #1a1a20; display: grid; place-items: center; cursor: default; }
.sbu-step-missing { padding: 12px; text-align: center; font-size: 12px; color: #a8a2c8; }
.sbu-step-x { position: absolute; top: 6px; right: 6px; z-index: 4; width: 20px; height: 20px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 999px; background: rgba(20,19,28,.85); color: #ddd; cursor: pointer; opacity: 0; transition: opacity .12s ease; }
.sbu-step:hover .sbu-step-x { opacity: 1; }
.sbu-step-reveal { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.sbu-add-shot { display: flex !important; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 0; border: 1.5px dashed rgba(255,255,255,.14); background: transparent !important; box-shadow: none !important; color: #b9b9c4; font: inherit; font-size: 12.5px; }
.sbu-add-shot:hover { border-color: rgba(190,176,255,.5); color: #fff; }
  position: absolute; left: 0; top: 0; z-index: 20; width: max(var(--step-w), 280px); max-height: 360px; display: flex; flex-direction: column; gap: 6px; padding: 8px;
  border-radius: 14px; background: #18181d; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 16px 40px rgba(0,0,0,.5);
}
.sbu-newflow { max-width: 760px; margin-bottom: 30px; display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 16px; background: #18181d; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 16px 40px rgba(0,0,0,.4); animation: sbu-composer-in .22s cubic-bezier(.32,.72,0,1) both; }
.sbu-newflow-row { display: flex; gap: 8px; }
.sbu-newflow-name, .sbu-newflow-group { height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: rgba(255,255,255,.04); color: #f2f2f5; font: inherit; font-size: 14px; outline: none; }
.sbu-newflow-name { flex: 1; font-weight: 500; }
.sbu-newflow-group { width: 180px; font-size: 12.5px; }
.sbu-chip { display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 8px; border-radius: 999px; background: rgba(255,255,255,.06); color: #b9b9c4; font-size: 11.5px; }
.sbu-chip[data-tone="busy"] { background: rgba(141,122,246,.16); color: #d4cbff; }
.sbu-chip[data-tone="warn"] { background: rgba(211,162,148,.14); color: #e2b7aa; }
.sbu-side-action { color: #d4cbff; display: flex; align-items: center; gap: 6px; }
.sbu-frame-wrap[data-device="mobile"], .sbu-frame-wrap[data-device="tablet"] { margin: 0 auto; }
.sbu-frame-wrap[data-device="mobile"] .sbu-frame, .sbu-frame-wrap[data-device="mobile"] > .sbu-annot { border-radius: 26px; }
.sbu-waves { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.sbu-dream-prompt { display: block; width: 100%; min-height: 64px; resize: none; border: 0; outline: none; background: transparent; color: #f2f2f5; font: inherit; font-size: 13.5px; line-height: 20px; padding: 4px 6px; box-sizing: border-box; }
.sbu-dream-prompt::placeholder { color: #6c6c77; }
.sbu-dream-bar { display: flex; align-items: center; gap: 8px; font-size: 11.5px; padding-left: 6px; }
.sbu-sketch { position: absolute; inset: 0; z-index: 4; border-radius: 10px; overflow: hidden; }
.sbu-sketch-catch { position: absolute; inset: 0; cursor: default; touch-action: none; box-shadow: inset 0 0 0 1.5px rgba(150,132,255,.55); border-radius: inherit; }
.sbu-sketch[data-tool="pen"] .sbu-sketch-catch { cursor: crosshair; }
.sbu-sketch[data-tool="block"] .sbu-sketch-catch { cursor: cell; }
.sbu-sketch-hover { position: absolute; pointer-events: none; outline: 1px solid rgba(150,132,255,.7); background: rgba(150,132,255,.06); }
.sbu-sketch-sel { position: absolute; pointer-events: none; outline: 1.5px solid #8d7af6; }
.sbu-sketch-label { position: absolute; left: -1.5px; bottom: 100%; margin-bottom: 4px; padding: 2px 7px; border-radius: 6px; background: #8d7af6; color: #fff; font: 500 11px/16px ui-monospace, Menlo, monospace; white-space: nowrap; }
.sbu-sketch-handle { position: absolute; width: 9px; height: 9px; margin: -5px 0 0 -5px; border-radius: 2px; background: #fff; box-shadow: 0 0 0 1.5px #8d7af6; pointer-events: auto; }
.sbu-sketch-handle[data-corner="nw"] { left: 0; top: 0; cursor: nwse-resize; }
.sbu-sketch-handle[data-corner="ne"] { left: 100%; top: 0; cursor: nesw-resize; }
.sbu-sketch-handle[data-corner="sw"] { left: 0; top: 100%; cursor: nesw-resize; }
.sbu-sketch-handle[data-corner="se"] { left: 100%; top: 100%; cursor: nwse-resize; }
.sbu-sketch-edit { position: absolute; box-sizing: border-box; padding: 2px 6px; border: 0; border-radius: 4px; outline: 2px solid #8d7af6; background: #fff; color: #111; font: inherit; font-size: 14px; pointer-events: auto; }
.sbu-sketch-bar {
  position: absolute; left: 50%; bottom: 16px; translate: -50% 0; z-index: 6; display: flex; align-items: center; gap: 2px; padding: 5px;
  border-radius: 14px; background: #18181d; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 16px 40px rgba(0,0,0,.45); white-space: nowrap;
}
.sbu-sketch-tool { width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 9px; background: transparent; color: #9a9aa5; cursor: pointer; transition: background .12s ease, color .12s ease; }
.sbu-sketch-tool:hover:not(:disabled) { background: rgba(255,255,255,.06); color: #e8e8ee; }
.sbu-sketch-tool[data-on="true"] { background: rgba(141,122,246,.22); color: #d9d2ff; }
.sbu-sketch-tool:disabled { opacity: .35; cursor: default; }
.sbu-sketch-sep { width: 1px; height: 18px; margin: 0 4px; background: rgba(255,255,255,.1); }
.sbu-sketch-count { padding: 0 10px 0 6px; font-size: 12px; color: #8a8a95; }
.sbu-sketch-go { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px 0 14px; border: 0; border-radius: 10px; background: #ebebf0; color: #17171c; font: inherit; font-size: 12.5px; font-weight: 500; cursor: pointer; }
.sbu-sketch-go:disabled { opacity: .3; cursor: default; }
.sbu-sketch-palette {
  position: absolute; right: 12px; top: 12px; bottom: 70px; z-index: 6; width: 260px; display: flex; flex-direction: column; gap: 6px; padding: 8px;
  border-radius: 14px; background: #18181d; border: 1px solid rgba(255,255,255,.1); box-shadow: 0 16px 40px rgba(0,0,0,.45);
}
.sbu-sketch-filter { height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); color: #ececf1; font: inherit; font-size: 12.5px; outline: none; }
.sbu-sketch-palette ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
.sbu-sketch-palette li > button { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 7px 9px; border: 0; border-radius: 8px; background: transparent; color: #e4e4ea; font: inherit; font-size: 12.5px; text-align: left; cursor: grab; }
.sbu-sketch-palette li > button:hover { background: rgba(255,255,255,.06); }
.sbu-sketch-palette .sbu-dim { font-size: 11.5px; }
.sbu-sketch-ghost { position: fixed; z-index: 70; translate: -50% -50%; padding: 8px 12px; border-radius: 10px; background: rgba(141,122,246,.92); color: #fff; font-size: 12px; font-weight: 500; pointer-events: none; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.sbu-hud { position: absolute; left: 12px; bottom: 12px; display: flex; gap: 6px; align-items: center; background: rgba(18,18,22,.9); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 4px; }
.sbu-hud button { border: 0; background: transparent; color: #d0d0d8; padding: 4px 8px; border-radius: 6px; cursor: pointer; font: inherit; }
.sbu-hud button:hover { background: rgba(255,255,255,.07); }


.sbu-thumb { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; background: #f2f2f4; isolation: isolate; pointer-events: none; }
.sbu-thumb[data-state="loading"] { background: #16151e; }
.sbu-thumb-note[data-on-waves="true"] { padding: 5px 12px; border-radius: 999px; background: rgba(20,19,28,.72); font-size: 12.5px; font-weight: 500; letter-spacing: .02em; }
.sbu-shimmer {
  color: #b9b0e8;
  background: linear-gradient(105deg, #9d94cc 0 38%, #ffffff 50%, #9d94cc 62% 100%);
  background-size: 300% 100%; background-position: 100% 0;
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  animation: sbu-shimmer 2.2s linear infinite;
}
.sbu-thumb[data-state="error"] { z-index: 1; background: #f3f3f5; }
.sbu-thumb-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; animation: sbu-fade .28s ease both; }
.sbu-thumb-img[data-incoming="true"] { opacity: 0; animation: none; }
.sbu-thumb-note { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(calc(1 / max(var(--sbu-k, 1), .5))); display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #9a9aa4; white-space: nowrap; letter-spacing: .01em; z-index: 1; }
.sbu-thumb-note button { pointer-events: auto; border: 0; background: none; padding: 0; font: inherit; color: #5c5c67; cursor: pointer; text-decoration: underline; text-decoration-color: rgba(92,92,103,.3); text-underline-offset: 3px; }
.sbu-thumb-note button:hover { color: #2c2c33; text-decoration-color: currentColor; }
@keyframes sbu-shimmer { 0% { background-position: 100% 0; } 70%, 100% { background-position: 0 0; } }
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

.sbu-composer {
  position: fixed; left: 0; top: 0; z-index: 60; visibility: hidden; box-sizing: border-box;
  display: flex; flex-direction: column; color: #ececf1;
}
.sbu-composer[data-placed="true"] { visibility: visible; animation: sbu-composer-in .22s cubic-bezier(.32,.72,0,1) both; }
.sbu-composer[data-phase="leaving"] { animation: sbu-pop-out .14s cubic-bezier(.4,0,1,1) both; }
@keyframes sbu-composer-in { from { opacity: 0; transform: translateY(4px) scale(.96); } to { opacity: 1; transform: none; } }
.sbu-composer-head {
  position: relative; display: flex; align-items: center; gap: 6px;
  width: calc(100% - 40px); margin: 0 auto -16px; padding: 3px 4px 19px; box-sizing: border-box;
  border-radius: 15px 15px 0 0; background: #222229; border: 1px solid rgba(255,255,255,.08); border-bottom: 0;
}
.sbu-composer-head .sbu-icon { width: 22px; height: 22px; }
.sbu-composer-head .sbu-seg { background: rgba(0,0,0,.22); }
.sbu-composer-card {
  position: relative; z-index: 1; display: flex; flex-direction: column; gap: 2px; padding: 6px;
  border-radius: 20px; border: 1px solid rgba(255,255,255,.09); background: #18181d;
  box-shadow: 0 22px 50px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.05);
}
.sbu-composer-card .sbu-chips-img { padding: 6px 6px 2px; }
.sbu-focus { position: fixed; inset: 0; z-index: 59; background: rgba(11,11,13,.94); animation: sbu-fade .18s ease both; }
.sbu-focus[data-phase="leaving"] { animation: sbu-fade-out .14s ease both; }
.sbu-focus-shot { position: absolute; display: grid; place-items: center; }
.sbu-focus-shot img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 10px; box-shadow: 0 0 0 1px rgba(141,122,246,.6), 0 24px 60px rgba(0,0,0,.5); opacity: 0; transition: opacity .2s ease; }
.sbu-focus-shot[data-loaded="true"] img { opacity: 1; }
.sbu-focus-shot .sbu-spin { position: absolute; }
@keyframes sbu-fade-out { from { opacity: 1; } to { opacity: 0; } }
.sbu-composer-input {
  display: block; width: 100%; min-height: 44px; max-height: 240px; margin: 0; padding: 8px 8px 4px; box-sizing: border-box;
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
  .sbu-shimmer, .sbu-float[data-placed="true"], .sbu-float[data-phase="leaving"], .sbu-composer[data-placed="true"], .sbu-composer[data-phase="leaving"], .sbu-focus, .sbu-pin, .sbu-imgchip, .sbu-sel, .sbu-annot-hint, .sbu-thumb-img, .sbu-drop { animation: none; }
  .sbu-frame-wrap, .sbu-sel[data-pin] { transition: none; }
}
`
