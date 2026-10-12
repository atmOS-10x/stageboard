import { useEffect, useState } from "react"
import { withQuery } from "./api"

export function Thumb({ src, className }: { src: string; className?: string }) {
  const [retry, setRetry] = useState(0)
  const requested = retry ? withQuery(src, { refresh: 1, r: retry }) : src
  const [shown, setShown] = useState<string>()
  const [failed, setFailed] = useState<string>()

  useEffect(() => setRetry(0), [src])

  const loading = shown !== requested && failed !== requested
  const broken = failed === requested && !shown

  return (
    <div className={`sbu-thumb ${className ?? ""}`} data-state={shown ? "ready" : broken ? "error" : "loading"}>
      {shown && <img className="sbu-thumb-img" src={shown} alt="" draggable={false} />}
      {shown !== requested && failed !== requested && (
        <img
          key={requested}
          className="sbu-thumb-img"
          data-incoming="true"
          src={requested}
          alt=""
          draggable={false}
          onLoad={() => setShown(requested)}
          onError={() => setFailed(requested)}
        />
      )}
      {!shown && loading && <span className="sbu-thumb-note">Rendering…</span>}
      {broken && (
        <span className="sbu-thumb-note" data-error="true">
          Couldn’t render
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setRetry(Date.now())
            }}
          >
            Retry
          </button>
        </span>
      )}
    </div>
  )
}
