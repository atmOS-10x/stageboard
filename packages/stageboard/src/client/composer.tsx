import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react"
import { submitChangeRequest, useStageboard } from "stageboard/react"
import type { ChangeRequest, Job, RegionDescription, Upload } from "stageboard"
import { besideRect, useAnchored, useAnnotate, useOutsidePointer, type Draft } from "./annotate"
import { describeInFrame, describeOnServer, uploadImage } from "./api"
import { ArrowUpIcon, CloseIcon, LayersIcon, PlusIcon } from "./icons"

type Mode = "variants" | "edit"

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
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

function imagesFrom(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith("image/"))
}

function useDescription(draft: Draft, base: string) {
  const [description, setDescription] = useState<RegionDescription>()
  const { surface, region, viewport } = draft
  useEffect(() => {
    setDescription(undefined)
    const local = describeInFrame(surface.frame?.(), region)
    if (local && (local.components.length || local.variantIds.length)) {
      setDescription(local)
      return
    }
    const ctrl = new AbortController()
    describeOnServer(base, surface.storyId, region, viewport, surface.variant ? [surface.variant] : [], ctrl.signal)
      .then(setDescription)
      .catch(() => {})
    return () => ctrl.abort()
  }, [base, surface, region, viewport])
  return description
}

function useAttachments(base: string) {
  const [items, setItems] = useState<Attachment[]>([])
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
      if (gone) URL.revokeObjectURL(gone.preview)
      return list.filter((it) => it.localId !== localId)
    })
    files.current.delete(localId)
  }, [])

  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.preview)), [])

  return { items, add, retry, remove }
}

export function Composer({ draft, onClose, onSent }: { draft: Draft; onClose: () => void; onSent: (job: Job) => void }) {
  const { base, anchor } = useAnnotate()
  const ref = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const placement = useAnchored(anchor, ref, besideRect(12))
  const connected = useStageboard((s) => s.connected)
  const description = useDescription(draft, base)
  const { items, add, retry, remove } = useAttachments(base)
  const [note, setNote] = useState("")
  const [mode, setMode] = useState<Mode>("variants")
  const [count, setCount] = useState(3)
  const [phase, setPhase] = useState<"idle" | "sending" | "leaving">("idle")
  const [error, setError] = useState<string>()
  const [dropping, setDropping] = useState(false)
  const dragDepth = useRef(0)
  const { surface } = draft

  const empty = !note.trim() && items.length === 0
  const canSend = Boolean(note.trim()) && connected && phase === "idle"

  const placed = Boolean(placement)
  useEffect(() => {
    if (placed) textarea.current?.focus({ preventScroll: true })
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
        note: note.trim(),
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

  const component = description?.components[0]?.name
  const variantIds = (description?.variantIds ?? []).filter((id) => id !== surface.variant?.id)

  return (
    <div
      ref={ref}
      className="sbu-float sbu-composer"
      data-placed={Boolean(placement)}
      data-phase={phase}
      style={placement ? { left: placement.left, top: placement.top, transformOrigin: placement.origin } : undefined}
      role="dialog"
      aria-label="Annotate region"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape") {
          e.preventDefault()
          onClose()
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void send()
        }
      }}
      {...dropHandlers}
    >
      <div className="sbu-composer-ctx">
        <div className="sbu-ctx-list">
          <span className="sbu-ctx" title={surface.storyId}>
            {surface.title}
          </span>
          {surface.variant && (
            <span className="sbu-ctx" title={`${surface.variant.id}:${surface.variant.key}`}>
              <LayersIcon size={11} />
              {surface.variant.label ?? surface.variant.key}
            </span>
          )}
          {component && (
            <span className="sbu-ctx sbu-ctx-mono" title={description?.components.map((c) => c.name).join(" ‹ ")}>
              {component}
            </span>
          )}
          {variantIds.map((id) => (
            <span key={id} className="sbu-ctx" title="Variant boundary under the selection">
              <LayersIcon size={11} />
              {id}
            </span>
          ))}
        </div>
        <button type="button" className="sbu-icon" onClick={onClose} aria-label="Close">
          <CloseIcon size={13} />
        </button>
      </div>

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
        rows={1}
        value={note}
        placeholder={mode === "variants" ? "What should the variants explore?" : "What should change here?"}
        onChange={(e) => setNote(e.target.value)}
        onPaste={onPaste}
        disabled={phase !== "idle"}
        aria-label="Note for the agent"
      />

      {error && <div className="sbu-composer-error">{error}</div>}
      {!connected && <div className="sbu-composer-error">Bridge offline · start it with stageboard dev</div>}

      <div className="sbu-composer-bar">
        <button type="button" className="sbu-icon" onClick={() => fileInput.current?.click()} aria-label="Attach reference images" title="Attach images · or paste, or drop">
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
        <div className="sbu-seg" role="radiogroup" aria-label="Request kind">
          <button type="button" role="radio" aria-checked={mode === "variants"} data-on={mode === "variants"} onClick={() => setMode("variants")}>
            Variants
          </button>
          <button type="button" role="radio" aria-checked={mode === "edit"} data-on={mode === "edit"} onClick={() => setMode("edit")}>
            Edit
          </button>
        </div>
        {mode === "variants" && (
          <div className="sbu-seg sbu-seg-count" role="radiogroup" aria-label="How many variants">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={count === n} data-on={count === n} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
        <span className="sbu-spacer" />
        {note.trim() && phase === "idle" && <span className="sbu-kbd-hint">{IS_MAC ? "⌘" : "Ctrl"} ↵</span>}
        <button type="button" className="sbu-send" disabled={!canSend} onClick={() => void send()} aria-label="Send">
          {phase === "idle" ? <ArrowUpIcon size={14} /> : <span className="sbu-spin" />}
        </button>
      </div>

      {dropping && <div className="sbu-drop">Drop images to attach</div>}
    </div>
  )
}
