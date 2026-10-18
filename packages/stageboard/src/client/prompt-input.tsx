import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from "react"
import { useStageboard } from "stageboard/react"
import type { Upload } from "stageboard"
import { uploadImage, uploadUrl } from "./api"
import { ArrowUpIcon, CloseIcon, PlusIcon } from "./icons"
import { IconButton } from "./kit"

type Attachment = {
  localId: string
  name: string
  preview: string
  status: "uploading" | "done" | "error"
  upload?: Upload
  promise: Promise<Upload | undefined>
}

const MAX_TEXTAREA = 240

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

export type PromptInputProps = {
  base: string
  value: string
  onChange: (value: string) => void
  onSubmit: (uploads: Upload[]) => Promise<void> | void
  placeholder: string
  label: string
  head?: ReactNode
  bar?: ReactNode
  onClose?: () => void
  allowEmpty?: boolean
  initialAttachments?: Upload[]
  onUploads?: (uploads: Upload[]) => void
  autoFocus?: boolean
  focusKey?: unknown
  minRows?: number
}

// The one input for talking to the agent: annotations, new flows, new screens, flow notes. A header strip
// for context, a growing text field that takes pasted or dropped reference images, and a send button.
export function PromptInput({
  base,
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  head,
  bar,
  onClose,
  allowEmpty = false,
  initialAttachments = [],
  onUploads,
  autoFocus = true,
  focusKey,
  minRows = 2,
}: PromptInputProps) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const connected = useStageboard((s) => s.connected)
  const { items, add, retry, remove } = useAttachments(base, initialAttachments)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()
  const [dropping, setDropping] = useState(false)
  const dragDepth = useRef(0)
  const canSend = (allowEmpty || Boolean(value.trim())) && connected && !sending

  const uploaded = items.flatMap((it) => (it.upload ? [it.upload] : []))
  const uploadedKey = uploaded.map((u) => u.id).join(",")
  const uploadsRef = useRef(onUploads)
  uploadsRef.current = onUploads
  useEffect(() => uploadsRef.current?.(uploaded), [uploadedKey])

  useEffect(() => {
    if (!autoFocus) return
    const el = textarea.current
    el?.focus({ preventScroll: true })
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [autoFocus, focusKey])

  useLayoutEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA)}px`
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA ? "auto" : "hidden"
  }, [value])

  const send = useCallback(async () => {
    if (!canSend) return
    setSending(true)
    setError(undefined)
    try {
      const uploads = (await Promise.all(items.map((it) => it.promise))).filter((u): u is Upload => Boolean(u))
      await onSubmit(uploads)
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^\d+\s*/, "") || "Request failed" : String(e))
    } finally {
      setSending(false)
    }
  }, [canSend, items, onSubmit])

  const onPaste = (e: ClipboardEvent) => {
    const files = imagesFrom(e.clipboardData?.files)
    if (!files.length) return
    e.preventDefault()
    add(files)
  }

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")

  return (
    <div
      className="sbu-prompt"
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Escape" && onClose) {
          e.preventDefault()
          onClose()
        }
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229 && (e.target as HTMLElement).tagName === "TEXTAREA") {
          e.preventDefault()
          void send()
        }
      }}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        dragDepth.current += 1
        setDropping(true)
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDropping(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        dragDepth.current = 0
        setDropping(false)
        add(imagesFrom(e.dataTransfer.files))
      }}
    >
      {(head || onClose) && (
        <div className="sbu-composer-head">
          {head}
          <span className="sbu-spacer" />
          {onClose && <IconButton size="sm" variant="ghost" icon={<CloseIcon size={14} />} label="Close · Esc" onClick={onClose} />}
        </div>
      )}
      <div className="sbu-composer-card">
        {items.length > 0 && (
          <ul className="sbu-chips-img">
            {items.map((it) => (
              <li key={it.localId} className="sbu-imgchip" data-status={it.status} title={it.name}>
                <img src={it.preview} alt={it.name} />
                {it.status === "uploading" && (
                  <span className="sbu-imgchip-veil">
                    <span className="sbu-spin" />
                  </span>
                )}
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
          rows={minRows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          disabled={sending}
          aria-label={label}
        />
        {error && <div className="sbu-composer-error">{error}</div>}
        {!connected && <div className="sbu-composer-error">Bridge offline · start it with stageboard dev</div>}
        <div className="sbu-composer-bar">
          <IconButton size="sm" variant="ghost" icon={<PlusIcon size={16} />} label="Attach reference images · or paste, or drop" onClick={() => fileInput.current?.click()} />
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
          {bar}
          <span className="sbu-spacer" />
          <IconButton variant="solid" icon={sending ? <span className="sbu-spin" /> : <ArrowUpIcon size={15} />} label="Send · Enter" disabled={!canSend} onClick={() => void send()} />
        </div>
      </div>
      {dropping && <div className="sbu-drop">Drop images to attach</div>}
    </div>
  )
}
