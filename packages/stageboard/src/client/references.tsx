import type { FlowReference } from "@atmos.build/stageboard"

export function referenceUrl(base: string, image: string): string {
  return `${base}/api/references?src=${encodeURIComponent(image)}`
}

export function ReferenceShot({ src, reference }: { src: string; reference: FlowReference }) {
  return (
    <span className="sbu-ref-shot">
      <img src={src} alt={reference.caption ?? reference.app ?? "Reference"} draggable={false} />
      <span className="sbu-ref-tag">Reference</span>
    </span>
  )
}

export function ReferenceList<T>({ references, srcOf }: { references: (Omit<FlowReference, "image"> & { image: T })[]; srcOf: (image: T) => string }) {
  return (
    <ul className="sbu-refs" aria-label="References">
      {references.map((r, i) => {
        const body = (
          <>
            <img src={srcOf(r.image)} alt="" draggable={false} />
            <span className="sbu-refs-text">
              {r.app && <span className="sbu-refs-app">{r.app}</span>}
              {r.caption && <span className="sbu-refs-caption">{r.caption}</span>}
            </span>
          </>
        )
        return (
          <li key={i}>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" title={r.caption ?? r.url}>
                {body}
              </a>
            ) : (
              <span title={r.caption}>{body}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
