import { githubUrl, homeUrl, privacyUrl } from "@/lib/shared"
import { CookieSettingsLink } from "./consent"

export function SiteFooter() {
  return (
    <footer className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-6 text-sm text-fd-muted-foreground">
      <a href={homeUrl} className="hover:text-fd-foreground">
        stageboard.design
      </a>
      <a href={githubUrl} className="hover:text-fd-foreground">
        GitHub
      </a>
      <a href={privacyUrl} className="hover:text-fd-foreground">
        Privacy
      </a>
      <CookieSettingsLink className="hover:text-fd-foreground" />
    </footer>
  )
}
