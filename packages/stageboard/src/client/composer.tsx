import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { submitChangeRequest, useStageboard } from "stageboard/react"
import type { ChangeRequest, Job, Upload } from "stageboard"
import { useAnnotate, useComposerPlacement, useOutsidePointer, type Draft } from "./annotate"
import { uploadImage, uploadUrl, withQuery } from "./api"
import { readPrefs, saveDraft, savePrefs, type ComposerMode } from "./draft-store"
import { ArrowUpIcon, CloseIcon, PlusIcon } from "./icons"

type Attachment = {
  localId: string
  name: string
  preview: string
  status: "uploading" | "done" | "error"
  upload?: Upload
  promise: Promise<Upload | undefined>
}

const MAX_TEXTAREA = 240
const EXIT_MS = 140

function imagesFrom(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"))
}

function restored(base: string, uploads: Upload[]): Attachment[] {
  return uploads.map((upload) => ({
    localId: upload.id,
    name: upload.name,
    preview: uploadUrl(base, upload.path),
    status: "done",
    upload,
    promise: Promise.resolve(upload),
  }))
}

function useAttachments(base: string, initial: Upload[]) {
  const [items, setItems] = useState<Attachment[]>(() => restored(base, initial))
  const itemsRef = useRef(items)
  itemsRef.current = items

  const patch = (localId: string, next: Partial<Attachment>) =>
    setItems((list) => list.map((it) => (it.localId === localId ? { ...it, ...next } : it)))

  const start = useCallback(
    (file: File, localId = Math.random().toString(36).slice(2), preview = URL.createObjectURL(file)) => {
      const promise = uploadImage(base, file).then(
        (upload) => {
          patch(localId, { status: "done", upload })
          return upload
        },
        () => {
          patch(localId, { status: "error" })
          return undefined
        },
      )
      return { localId, name: file.name, preview, status: "uploading" as const, promise }
    },
    [base],
  )

  const files = useRef(new Map<string, File>())

  const add = useCallback(
    (list: File[]) => {
      const next = list.map((file) => {
        const item = start(file)
        files.current.set(item.localId, file)
        return item
      })
      setItems((cur) => [...cur, ...next])
    },
    [start],
  )

  const retry = useCallback(
    (localId: string) => {
      const file = files.current.get(localId)
      const cur = itemsRef.current.find((it) => it.localId === localId)
      if (!file || !cur) return
      const item = start(file, localId, cur.preview)
      setItems((list) => list.map((it) => (it.localId === localId ? item : it)))
    },
    [start],
  )

  const remove = useCallback((localId: string) => {
    setItems((list) => {
      const gone = list.find((it) => it.localId === localId)
      if (gone?.preview.startsWith("blob:")) URL.revokeObjectURL(gone.preview)
      return list.filter((it) => it.localId !== localId)
    })
    files.current.delete(localId)
  }, [])

  useEffect(() => () => itemsRef.current.forEach((it) => it.preview.startsWith("blob:") && URL.revokeObjectURL(it.preview)), [])

  return { items, add, retry, remove }
}

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
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const placement = useComposerPlacement(anchor, ref)
  const connected = useStageboard((s) => s.connected)
  const { items, add, retry, remove } = useAttachments(base, draft.restored?.attachments ?? [])
  const [note, setNote] = useState(draft.restored?.note ?? "")
  const [prefs, setPrefs] = useState(readPrefs)
  const { mode, count } = prefs
  const [phase, setPhase] = useState<"idle" | "sending" | "leaving">("idle")
  const [error, setError] = useState<string>()
  const [dropping, setDropping] = useState(false)
  const [previewLoaded, setPreviewLoaded] = useState(false)
  const dragDepth = useRef(0)
  const { surface } = draft

  const empty = !note.trim() && items.length === 0
  const canSend = (Boolean(note.trim()) || Boolean(draft.sketch)) && connected && phase === "idle"
  const preview = placement?.preview
  const previewSrc = preview ? previewUrl(base, draft) : undefined

  const setPref = (next: Partial<typeof prefs>) =>
    setPrefs((cur) => {
      const merged = { ...cur, ...next }
      savePrefs(merged)
      return merged
    })

  const uploaded = items.flatMap((it) => (it.upload ? [it.upload] : []))
  const uploadedKey = uploaded.map((u) => u.id).join(",")
  useEffect(() => {
    if (phase !== "idle") return
    saveDraft({ surfaceKey: surface.key, region: draft.region, viewport: draft.viewport, scroll: draft.scroll, sketch: draft.sketch, note, attachments: uploaded })
  }, [note, uploadedKey, draft, phase])

  useEffect(() => setPreviewLoaded(false), [previewSrc])

  const placed = Boolean(placement)
  useEffect(() => {
    if (!placed) return
    const el = textarea.current
    el?.focus({ preventScroll: true })
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [draft, placed])

  useLayoutEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA)}px`
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA ? "auto" : "hidden"
  }, [note])

  useOutsidePointer(
    ref,
    (t) => {
      if (empty && phase === "idle" && !t.closest(".sbu-annot-catch")) onClose()
    },
    phase === "idle",
  )

  const send = async () => {
    if (!canSend) return
    setPhase("sending")
    setError(undefined)
    try {
      const uploads = await Promise.all(items.map((it) => it.promise))
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
        attachments: uploads.filter((u): u is Upload => Boolean(u)).map((u) => u.id),
        showVariants: Boolean(variant),
        ...(draft.sketch ? { sketch: draft.sketch } : {}),
      }
      const job = await submitChangeRequest(change)
      setPhase("leaving")
      setTimeout(() => onSent(job), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : EXIT_MS)
    } catch (e) {
      setPhase("idle")
      setError(e instanceof Error ? e.message.replace(/^\d+\s*/, "") || "Request failed" : String(e))
    }
  }

  const onPaste = (e: ClipboardEvent) => {
    const files = imagesFrom(e.clipboardData?.files)
    if (!files.length) return
    e.preventDefault()
    add(files)
  }

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")
  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current += 1
      setDropping(true)
    },
    onDragOver: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current) setDropping(false)
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDropping(false)
      add(imagesFrom(e.dataTransfer.files))
    },
  }

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
        data-placed={placed}
        data-phase={phase}
        style={
          placement
            ? { left: placement.panel.x, top: placement.panel.y, width: placement.panel.width, transformOrigin: placement.origin }
            : undefined
        }
        role="dialog"
        aria-label="Annotate region"
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Escape") {
            e.preventDefault()
            onClose()
          }
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault()
            void send()
          }
        }}
        {...dropHandlers}
      >
        <div className="sbu-composer-head">
          <div className="sbu-seg" role="radiogroup" aria-label="Request kind">
            {(["variants", "edit"] as ComposerMode[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} data-on={mode === m} onClick={() => setPref({ mode: m })}>
                {m === "variants" ? "Variants" : "Edit"}
              </button>
            ))}
          </div>
          <span className="sbu-spacer" />
          <button type="button" className="sbu-icon" onClick={onClose} aria-label="Close">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="sbu-composer-card">
          {items.length > 0 && (
            <ul className="sbu-chips-img">
              {items.map((it) => (
                <li key={it.localId} className="sbu-imgchip" data-status={it.status} title={it.name}>
                  <img src={it.preview} alt={it.name} />
                  {it.status === "uploading" && <span className="sbu-imgchip-veil"><span className="sbu-spin" /></span>}
                  {it.status === "error" && (
                    <button type="button" className="sbu-imgchip-veil" onClick={() => retry(it.localId)} aria-label={`Retry ${it.name}`}>
                      Retry
                    </button>
                  )}
                  <button type="button" className="sbu-imgchip-x" onClick={() => remove(it.localId)} aria-label={`Remove ${it.name}`}>
                    <CloseIcon size={9} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <textarea
            ref={textarea}
            className="sbu-composer-input"
            rows={2}
            value={note}
            placeholder={
              draft.sketch
                ? mode === "variants"
                  ? `${draft.sketch.ops.length} sketched change${draft.sketch.ops.length === 1 ? "" : "s"} · anything the variants should explore?`
                  : `${draft.sketch.ops.length} sketched change${draft.sketch.ops.length === 1 ? "" : "s"} · anything to add? (optional)`
                : mode === "variants"
                  ? "What should the variants explore?"
                  : "What should change here?"
            }
            onChange={(e) => setNote(e.target.value)}
            onPaste={onPaste}
            disabled={phase !== "idle"}
            aria-label="Note for the agent"
          />

          {error && <div className="sbu-composer-error">{error}</div>}
          {!connected && <div className="sbu-composer-error">Bridge offline · start it with stageboard dev</div>}

          <div className="sbu-composer-bar">
            <button type="button" className="sbu-icon" onClick={() => fileInput.current?.click()} aria-label="Attach reference images" title="Attach reference images · or paste, or drop">
              <PlusIcon size={15} />
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                add(imagesFrom(e.target.files))
                e.target.value = ""
              }}
            />
            {mode === "variants" && (
              <div className="sbu-seg sbu-seg-count" role="radiogroup" aria-label="How many variants">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={count === n} data-on={count === n} onClick={() => setPref({ count: n })}>
                    {n}
                  </button>
                ))}
              </div>
            )}
            <span className="sbu-spacer" />
            <button type="button" className="sbu-send" disabled={!canSend} onClick={() => void send()} aria-label="Send" title="Send · Enter">
              {phase === "idle" ? <ArrowUpIcon size={14} /> : <span className="sbu-spin" />}
            </button>
          </div>
        </div>

        {dropping && <div className="sbu-drop">Drop images to attach</div>}
      </div>
    </>
  )
}
