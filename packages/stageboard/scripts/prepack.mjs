// Copies the repo's README and LICENSE into the package before it is packed, so they ship to npm. Relative links
// (.github/assets/…, docs/…) become absolute GitHub URLs, because npm renders the README outside the repo.
import { readFileSync, writeFileSync, copyFileSync } from "node:fs"

const repo = "https://github.com/atmOS-10x/stageboard"
const raw = "https://raw.githubusercontent.com/atmOS-10x/stageboard/main"
const readme = readFileSync("../../README.md", "utf8")
  .replace(/(src|href)="(\.github\/[^"]+)"/g, (_, attr, path) => `${attr}="${raw}/${path}"`)
  .replace(/\]\((?!https?:|#)([^)]+)\)/g, (_, path) => `](${repo}/blob/main/${path})`)
writeFileSync("README.md", readme)
copyFileSync("../../LICENSE", "LICENSE")
