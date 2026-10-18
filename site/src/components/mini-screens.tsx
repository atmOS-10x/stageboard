import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"

// Screens of a made-up travel app, Fernway, drawn at a fixed size and scaled to fit, the way the board shows thumbnails.
// The photos in public/photos were generated for it.

export const SCREEN_W = 480
export const SCREEN_H = 300

export function Scaled({ children, width = SCREEN_W, height = SCREEN_H, className }: { children: ReactNode; width?: number; height?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setK(el.clientWidth / width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${className ?? ""}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `scale(${k})`, visibility: k ? undefined : "hidden" }}>
        {children}
      </div>
    </div>
  )
}

export type PhotoName = "bled-cabin" | "bled-interior" | "bled-terrace" | "comporta" | "lofoten" | "hallstatt" | "annecy"

export function Photo({ name, className }: { name: PhotoName; className?: string }) {
  return <img src={`/photos/${name}.jpg`} alt="" draggable={false} className={`block bg-zinc-200 object-cover ${className ?? ""}`} />
}

function AppNav({ active }: { active?: string }) {
  return (
    <div className="flex h-9 items-center gap-4 border-b border-zinc-100 px-5 text-[10px] text-zinc-500">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-900">
        <span className="size-3 rounded-full bg-emerald-600" /> Fernway
      </span>
      {["Stays", "Trips", "Saved"].map((l) => (
        <span key={l} className={l === active ? "font-medium text-zinc-900" : ""}>
          {l}
        </span>
      ))}
      <span className="ml-auto size-5 rounded-full bg-zinc-200" />
    </div>
  )
}

export function HomeScreen() {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <AppNav active="Stays" />
      <div className="px-5 pt-5">
        <div className="text-[22px] leading-[1.1] font-semibold tracking-tight">Find a quiet place<br />by the water.</div>
        <div className="mt-3 flex h-8 items-center gap-2 rounded-full border border-zinc-200 px-3 text-[10px] text-zinc-400">
          <span className="size-2.5 rounded-full border border-zinc-300" /> Where to? <span className="ml-auto rounded-full bg-zinc-900 px-2.5 py-1 text-white">Search</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {(
            [
              ["bled-cabin", "Lake Bled", "from €140"],
              ["comporta", "Comporta", "from €210"],
              ["lofoten", "Lofoten", "from €180"],
            ] as const
          ).map(([photo, name, price]) => (
            <div key={name}>
              <Photo name={photo} className="h-[86px] w-full rounded-lg" />
              <div className="mt-1.5 text-[10px] font-medium">{name}</div>
              <div className="text-[9px] text-zinc-500">{price}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const RESULTS = [
  ["Cabin on Lake Bled", "€140", "bled-cabin", "4.9 (128 reviews)"],
  ["Boathouse, Hallstatt", "€165", "hallstatt", "4.8 (94 reviews)"],
  ["Glass lodge, Annecy", "€190", "annecy", "4.9 (61 reviews)"],
] as const

export function SearchScreen({ pressed }: { pressed?: boolean }) {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <AppNav active="Stays" />
      <div className="flex gap-1.5 px-5 pt-3 text-[9px]">
        {["Lakeside", "2 guests", "Jun 12 – 15", "Under €200"].map((f, i) => (
          <span key={f} className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600"}`}>
            {f}
          </span>
        ))}
      </div>
      <div className="mt-3 space-y-2.5 px-5">
        {RESULTS.map(([title, price, photo, rating], i) => (
          <div key={title} className={`flex items-center gap-3 rounded-xl border p-2 transition-colors ${pressed && i === 0 ? "border-emerald-600/40 bg-emerald-50/60" : "border-zinc-100"}`}>
            <Photo name={photo} className="h-12 w-16 rounded-md" />
            <div className="flex-1">
              <div className="text-[11px] font-medium">{title}</div>
              <div className="text-[9px] text-zinc-500">{rating}</div>
            </div>
            <div className="text-[11px] font-semibold">{price}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ListingScreen({ pressed }: { pressed?: boolean }) {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <AppNav active="Stays" />
      <div className="grid grid-cols-[1fr_150px] gap-4 px-5 pt-4">
        <div>
          <div className="grid h-[120px] grid-cols-[2fr_1fr] gap-1.5">
            <Photo name="bled-cabin" className="h-full w-full rounded-l-xl" />
            <div className="grid grid-rows-2 gap-1.5">
              <Photo name="bled-interior" className="h-full w-full rounded-tr-xl" />
              <Photo name="bled-terrace" className="h-full w-full rounded-br-xl" />
            </div>
          </div>
          <div className="mt-2.5 text-[15px] font-semibold tracking-tight">Cabin on Lake Bled</div>
          <div className="mt-1 text-[9.5px] leading-snug text-zinc-500">A timber cabin on the north shore, with a wood stove, a private jetty and the castle across the water.</div>
        </div>
        <div className="self-start rounded-xl border border-zinc-200 p-3 shadow-sm">
          <div className="text-[13px] font-semibold">€140 <span className="text-[9px] font-normal text-zinc-500">night</span></div>
          <div className="mt-2 rounded-md border border-zinc-200 px-2 py-1.5 text-[9px] text-zinc-500">Jun 12 – 15, 2 guests</div>
          <div className={`mt-2 rounded-full py-1.5 text-center text-[10px] font-medium text-white transition-colors ${pressed ? "bg-emerald-900" : "bg-emerald-700"}`}>Reserve</div>
          <div className="mt-1.5 text-center text-[8.5px] text-zinc-400">You won't be charged yet</div>
        </div>
      </div>
    </div>
  )
}

export type CheckoutProps = {
  /** The design after the agent reconciled the sketch: total on its own line, one accent, a full-width pay button. */
  revised?: boolean
  payStyle?: CSSProperties
  paySelected?: boolean
}

export function CheckoutScreen({ revised, payStyle, paySelected }: CheckoutProps) {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <AppNav />
      <div className="grid grid-cols-[1fr_160px] gap-5 px-5 pt-4">
        <div className="relative">
          <div className="text-[15px] font-semibold tracking-tight">Confirm and pay</div>
          {["Card number", "Expiry", "Name on card"].map((f) => (
            <div key={f} className="mt-2">
              <div className="text-[8.5px] text-zinc-500">{f}</div>
              <div className="mt-0.5 h-6 rounded-md border border-zinc-200" />
            </div>
          ))}
          {revised ? (
            <div className="mt-3 rounded-full bg-zinc-900 py-2 text-center text-[10.5px] font-medium text-white">Pay €462</div>
          ) : (
            <div className="relative mt-3 w-28 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)]" style={payStyle}>
              <div className="rounded-full bg-emerald-700 py-1.5 text-center text-[10px] font-medium text-white">Pay €462</div>
              {paySelected && <SelectionHandles />}
            </div>
          )}
        </div>
        {revised ? (
          <div className="self-start rounded-xl border border-zinc-200 p-3 text-[9.5px]">
            <Photo name="bled-cabin" className="h-14 w-full rounded-md" />
            <div className="mt-2 font-medium">Cabin on Lake Bled</div>
            <div className="mt-0.5 text-zinc-500">3 nights, Jun 12 – 15</div>
            <div className="mt-3 text-[8.5px] text-zinc-500">Total</div>
            <div className="text-[17px] font-semibold tracking-tight">€462</div>
          </div>
        ) : (
          <div className="self-start rounded-xl bg-zinc-50 p-3 text-[9.5px]">
            <Photo name="bled-cabin" className="h-14 w-full rounded-md" />
            <div className="mt-2 font-medium">Cabin on Lake Bled</div>
            <div className="mt-2 flex justify-between text-zinc-500"><span>3 nights</span><span>€420</span></div>
            <div className="flex justify-between text-zinc-500"><span>Cleaning</span><span>€42</span></div>
            <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-semibold text-emerald-700"><span>Total</span><span>€462</span></div>
          </div>
        )}
      </div>
    </div>
  )
}

export function DoneScreen() {
  return (
    <div className="flex h-full w-full flex-col bg-white text-zinc-900">
      <AppNav active="Trips" />
      <div className="grid flex-1 grid-cols-[1fr_1fr] items-center gap-5 px-5">
        <div>
          <div className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          <div className="mt-3 text-[17px] leading-tight font-semibold tracking-tight">You're going<br />to Bled</div>
          <div className="mt-1.5 text-[10px] text-zinc-500">Confirmation FW-2041</div>
          <div className="mt-3 inline-block rounded-full border border-zinc-200 px-3 py-1 text-[10px]">View trip</div>
        </div>
        <Photo name="bled-terrace" className="h-[170px] w-full rounded-xl" />
      </div>
    </div>
  )
}

export function TripsScreen() {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <AppNav active="Trips" />
      <div className="px-5 pt-4">
        <div className="text-[15px] font-semibold tracking-tight">Your trips</div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {(
            [
              ["Lake Bled", "Jun 12 – 15", "bled-cabin"],
              ["Lofoten", "Aug 2 – 9", "lofoten"],
            ] as const
          ).map(([title, dates, photo]) => (
            <div key={title} className="overflow-hidden rounded-xl border border-zinc-100">
              <Photo name={photo} className="h-[118px] w-full" />
              <div className="p-2">
                <div className="text-[11px] font-medium">{title}</div>
                <div className="text-[9px] text-zinc-500">{dates}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SavedScreen() {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <AppNav active="Saved" />
      <div className="px-5 pt-4">
        <div className="flex items-baseline gap-2">
          <div className="text-[15px] font-semibold tracking-tight">Saved for later</div>
          <div className="text-[10px] text-zinc-500">4 stays</div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {(["hallstatt", "annecy", "comporta", "lofoten"] as const).map((p, i) => (
            <div key={p}>
              <div className="relative">
                <Photo name={p} className="h-[96px] w-full rounded-lg" />
                <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-white/90 text-[8px] text-rose-500">♥</span>
              </div>
              <div className="mt-1.5 text-[9.5px] font-medium">{["Hallstatt", "Annecy", "Comporta", "Lofoten"][i]}</div>
              <div className="text-[8.5px] text-zinc-500">{["€165", "€190", "€210", "€180"][i]} night</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const SCREENS = [
  { name: "Home", route: "/", Screen: HomeScreen },
  { name: "Search", route: "/search", Screen: SearchScreen },
  { name: "Listing", route: "/stays/bled", Screen: ListingScreen },
  { name: "Checkout", route: "/checkout", Screen: CheckoutScreen },
  { name: "Booked", route: "/trips/fw-2041", Screen: DoneScreen },
  { name: "Trips", route: "/trips", Screen: TripsScreen },
  { name: "Saved", route: "/saved", Screen: SavedScreen },
]

// Phone versions, drawn at 240 × 500, for the demos on small screens (stageboard's Mobile device).

export const PHONE_W = 240
export const PHONE_H = 500

function PhoneBar({ title, back }: { title?: string; back?: boolean }) {
  return (
    <div className="flex h-10 items-center gap-2 px-4 pt-2 text-[11px] font-semibold text-zinc-900">
      {back ? <span className="text-[14px] text-zinc-500">‹</span> : <span className="size-3 rounded-full bg-emerald-600" />}
      {title ?? "Fernway"}
      <span className="ml-auto size-5 rounded-full bg-zinc-200" />
    </div>
  )
}

export function PhoneSearch({ pressed }: { pressed?: boolean }) {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <PhoneBar />
      <div className="flex gap-1.5 overflow-hidden px-4 pt-1 text-[9px]">
        {["Lakeside", "2 guests", "Jun 12 – 15"].map((f, i) => (
          <span key={f} className={`shrink-0 rounded-full px-2.5 py-1 ${i === 0 ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600"}`}>{f}</span>
        ))}
      </div>
      <div className="mt-3 space-y-3 px-4">
        {RESULTS.map(([title, price, photo, rating], i) => (
          <div key={title} className={`rounded-xl transition-colors ${pressed && i === 0 ? "bg-emerald-50 ring-2 ring-emerald-600/30" : ""}`}>
            <Photo name={photo} className="h-[96px] w-full rounded-xl" />
            <div className="mt-1.5 flex items-baseline px-0.5">
              <span className="text-[11px] font-medium">{title}</span>
              <span className="ml-auto text-[11px] font-semibold">{price}</span>
            </div>
            <div className="px-0.5 text-[9px] text-zinc-500">{rating}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PhoneListing({ pressed }: { pressed?: boolean }) {
  return (
    <div className="relative h-full w-full bg-white text-zinc-900">
      <Photo name="bled-cabin" className="h-[200px] w-full" />
      <div className="px-4 pt-3">
        <div className="text-[16px] leading-tight font-semibold tracking-tight">Cabin on Lake Bled</div>
        <div className="mt-1 text-[9.5px] text-zinc-500">4.9 (128 reviews)</div>
        <div className="mt-2 text-[10px] leading-snug text-zinc-600">A timber cabin on the north shore, with a wood stove, a private jetty and the castle across the water.</div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Photo name="bled-interior" className="h-[64px] w-full rounded-lg" />
          <Photo name="bled-terrace" className="h-[64px] w-full rounded-lg" />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-zinc-100 bg-white px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold">€140 <span className="text-[9px] font-normal text-zinc-500">night</span></div>
          <div className="text-[9px] text-zinc-500">Jun 12 – 15</div>
        </div>
        <div className={`ml-auto rounded-full px-5 py-2 text-[10.5px] font-medium text-white transition-colors ${pressed ? "bg-emerald-900" : "bg-emerald-700"}`}>Reserve</div>
      </div>
    </div>
  )
}

export function PhoneCheckout({ revised, payStyle, paySelected }: CheckoutProps) {
  return (
    <div className="relative h-full w-full bg-white text-zinc-900">
      <PhoneBar title="Confirm and pay" back />
      <div className="px-4 pt-1">
        {revised ? (
          <div className="rounded-xl border border-zinc-200 p-3 text-[9.5px]">
            <div className="flex gap-2.5">
              <Photo name="bled-cabin" className="size-12 rounded-md" />
              <div>
                <div className="font-medium">Cabin on Lake Bled</div>
                <div className="mt-0.5 text-zinc-500">3 nights, Jun 12 – 15</div>
              </div>
            </div>
            <div className="mt-3 text-[8.5px] text-zinc-500">Total</div>
            <div className="text-[18px] font-semibold tracking-tight">€462</div>
          </div>
        ) : (
          <div className="rounded-xl bg-zinc-50 p-3 text-[9.5px]">
            <div className="flex gap-2.5">
              <Photo name="bled-cabin" className="size-12 rounded-md" />
              <div className="font-medium">Cabin on Lake Bled</div>
            </div>
            <div className="mt-2 flex justify-between text-zinc-500"><span>3 nights</span><span>€420</span></div>
            <div className="flex justify-between text-zinc-500"><span>Cleaning</span><span>€42</span></div>
            <div className="mt-1 flex justify-between border-t border-zinc-200 pt-1 font-semibold text-emerald-700"><span>Total</span><span>€462</span></div>
          </div>
        )}
        {["Card number", "Expiry", "Name on card"].map((f) => (
          <div key={f} className="mt-2.5">
            <div className="text-[8.5px] text-zinc-500">{f}</div>
            <div className="mt-0.5 h-7 rounded-md border border-zinc-200" />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-4 bottom-5">
        {revised ? (
          <div className="rounded-full bg-zinc-900 py-2.5 text-center text-[11px] font-medium text-white">Pay €462</div>
        ) : (
          <div className="relative w-28 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)]" style={payStyle}>
            <div className="rounded-full bg-emerald-700 py-2 text-center text-[10.5px] font-medium text-white">Pay €462</div>
            {paySelected && <SelectionHandles />}
          </div>
        )}
      </div>
    </div>
  )
}

export function SelectionHandles() {
  return (
    <span className="pointer-events-none absolute -inset-1 rounded-[6px] border border-[#8d7af6]">
      {["-top-1 -left-1", "-top-1 -right-1", "-bottom-1 -left-1", "-bottom-1 -right-1"].map((c) => (
        <span key={c} className={`absolute size-1.5 rounded-[1px] border border-[#8d7af6] bg-white ${c}`} />
      ))}
    </span>
  )
}

export function PhoneDone() {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <Photo name="bled-terrace" className="h-[230px] w-full" />
      <div className="px-4 pt-4">
        <div className="grid size-8 place-items-center rounded-full bg-emerald-50 text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <div className="mt-2.5 text-[18px] leading-tight font-semibold tracking-tight">You're going to Bled</div>
        <div className="mt-1 text-[10px] text-zinc-500">Confirmation FW-2041</div>
        <div className="mt-4 rounded-full border border-zinc-200 py-2 text-center text-[10.5px]">View trip</div>
      </div>
    </div>
  )
}

export function PhoneSaved() {
  return (
    <div className="h-full w-full bg-white text-zinc-900">
      <PhoneBar title="Saved for later" />
      <div className="mt-1 grid grid-cols-2 gap-2.5 px-4">
        {(["hallstatt", "annecy", "comporta", "lofoten"] as const).map((p, i) => (
          <div key={p}>
            <div className="relative">
              <Photo name={p} className="h-[118px] w-full rounded-lg" />
              <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-white/90 text-[8px] text-rose-500">♥</span>
            </div>
            <div className="mt-1.5 text-[10px] font-medium">{["Hallstatt", "Annecy", "Comporta", "Lofoten"][i]}</div>
            <div className="text-[9px] text-zinc-500">{["€165", "€190", "€210", "€180"][i]} night</div>
          </div>
        ))}
      </div>
    </div>
  )
}
