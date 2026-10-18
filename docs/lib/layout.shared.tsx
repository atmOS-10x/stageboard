import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { Logo } from "@/components/logo"
import { githubUrl, homeUrl } from "./shared"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Logo />,
      url: "/",
    },
    githubUrl,
    links: [{ text: "stageboard.design", url: homeUrl, external: true }],
  }
}
