import { useEffect, useRef, useState } from "react"
import { submitChangeRequest } from "stageboard/react"
import type { ChangeRequest, Job, Upload } from "stageboard"
import { useAnnotate, useComposerPlacement, useOutsidePointer, type Draft } from "./annotate"
import { withQuery } from "./api"
import { readPrefs, saveDraft, savePrefs, type ComposerMode } from "./draft-store"
import { PromptInput } from "./prompt-input"

const EXIT_MS = 140

function previewUrl(base: string, draft: Draft): string {
  const { surface, region, viewport } = draft
  const pad = 16
  return withQuery(`${base}/api/shot`, {
    story: surface.storyId,
    w: viewport.width,
    h: viewport.height,
    x: Math.max(0, region.x - pad),
    y: Math.max(0, region.y - pad),
    rw: region.width + pad * 2,
    rh: region.height + pad * 2,
    variant: surface.variant ? `${surface.variant.id}:${surface.variant.key}` : undefined,
    cs: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : undefined,
  })
}

export function Composer({ draft, onClose, onSent }: { draft: Draft; onClose: () => void; onSent: (job: Job) => void }) {
  const { base, anchor } = useAnnotate()
  const ref = useRef<HTMLDivElement>(null)
  const placement = useComposerPlacement(anchor, ref)
  const [note, setNote] = useState(draft.restored?.note ?? "")
  const [uploads, setUploads] = useState<Upload[]>(draft.restored?.attachments ?? [])
  const [prefs, setPrefs] = useState(readPrefs)
  const { mode, count } = prefs
  const [phase, setPhase] = useState<"idle" | "leaving">("idle")
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const { surface } = draft
  const preview = placement?.preview
  const previewSrc = preview ? previewUrl(base, draft) : undefined
  const empty = !note.trim() && uploads.length === 0

  const setPref = (next: Partial<typeof prefs>) =>
    setPrefs((cur) => {
      const merged = { ...cur, ...next }
      savePrefs(merged)
      return merged
    })

  const uploadedKey = uploads.map((u) => u.id).join(",")
  useEffect(() => {
    if (phase !== "idle") return
    saveDraft({ surfaceKey: surface.key, region: draft.region, viewport: draft.viewport, scroll: draft.scroll, sketch: draft.sketch, note, attachments: uploads })
  }, [note, uploadedKey, draft, phase])

  useEffect(() => setPreviewLoaded(false), [previewSrc])

  useOutsidePointer(
    ref,
    (t) => {
      if (empty && phase === "idle" && !t.closest(".sbu-annot-catch")) onClose()
    },
    phase === "idle",
  )

  const submit = async (files: Upload[]) => {
    const variant = surface.variant
    const change: ChangeRequest = {
      kind: mode,
      note: note.trim() || "Make the page look like my sketch.",
      count: mode === "variants" ? count : 1,
      target: {
        url: surface.url,
        title: surface.title,
        selector: "",
        tag: "region",
        rect: draft.region,
        viewport: draft.viewport,
        components: [],
        storyId: surface.storyId,
        region: draft.region,
        ...(variant ? { variantId: variant.id, variantKeys: { [variant.id]: variant.key } } : {}),
      },
      attachments: files.map((u) => u.id),
      showVariants: Boolean(variant),
      ...(draft.sketch ? { sketch: draft.sketch } : {}),
    }
    const job = await submitChangeRequest(change)
    setPhase("leaving")
    setTimeout(() => onSent(job), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXIT_MS)
  }

  const sketched = draft.sketch ? `${draft.sketch.ops.length} sketched change${draft.sketch.ops.length === 1 ? "" : "s"} · ` : ""

  return (
    <>
      {preview && previewSrc && (
        <div className="sbu-focus" data-phase={phase}>
          <div className="sbu-focus-shot" style={{ left: preview.x, top: preview.y, width: preview.width, height: preview.height }} data-loaded={previewLoaded}>
            <img src={previewSrc} alt="Selected area" onLoad={() => setPreviewLoaded(true)} />
            {!previewLoaded && <span className="sbu-spin" aria-hidden="true" />}
          </div>
        </div>
      )}
      <div
        ref={ref}
        className="sbu-composer"
        data-placed={Boolean(placement)}
        data-phase={phase}
        style={placement ? { left: placement.panel.x, top: placement.panel.y, width: placement.panel.width, transformOrigin: placement.origin } : undefined}
        role="dialog"
        aria-label="Annotate region"
      >
        <PromptInput
          base={base}
          value={note}
          onChange={setNote}
          onSubmit={submit}
          onClose={onClose}
          onUploads={setUploads}
          initialAttachments={draft.restored?.attachments}
          allowEmpty={Boolean(draft.sketch)}
          autoFocus={Boolean(placement)}
          focusKey={draft}
          label="Note for the agent"
          placeholder={
            mode === "variants" ? `${sketched}${sketched ? "anything the variants should explore?" : "What should the variants explore?"}` : `${sketched}${sketched ? "anything to add? (optional)" : "What should change here?"}`
          }
          head={
            <div className="sbu-seg" role="radiogroup" aria-label="Request kind">
              {(["edit", "variants"] as ComposerMode[]).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} data-on={mode === m} onClick={() => setPref({ mode: m })}>
                  {m === "variants" ? "Variants" : "Edit"}
                </button>
              ))}
            </div>
          }
          bar={
            mode === "variants" && (
              <div className="sbu-seg sbu-seg-count" role="radiogroup" aria-label="How many variants">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={count === n} data-on={count === n} onClick={() => setPref({ count: n })}>
                    {n}
                  </button>
                ))}
              </div>
            )
          }
        />
      </div>
    </>
  )
}
