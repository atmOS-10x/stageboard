import Image from "next/image"
import logo from "@/src/assets/logo.svg"

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <Image src={logo} alt="" width={24} height={24} className="size-6 rounded-[6px]" priority />
      <span>stageboard</span>
    </span>
  )
}
