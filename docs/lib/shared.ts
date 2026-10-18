export const siteUrl = "https://docs.stageboard.design"
export const homeUrl = "https://stageboard.design"
export const privacyUrl = "https://stageboard.design/privacy"
export const gitConfig = { user: "atmOS-10x", repo: "stageboard", branch: "main" }
export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`

/** Where a page's content lives in the repo, for "Open in GitHub". */
export function githubFileUrl(path: string) {
  return `${githubUrl}/blob/${gitConfig.branch}/docs/src/content/docs/${path}`
}

/** The Markdown version of a page: /quick-start.md, /guides/flows.md, /index.md for the introduction. */
export function markdownUrl(slugs: string[]) {
  return `/${slugs.length === 0 ? "index" : slugs.join("/")}.md`
}

export const llmsDescription =
  "stageboard renders every screen, flow and component of a React app on one board from Storybook-compatible stories with mock data. People annotate it and an agent (Claude Code, Codex, atmOS or any CLI) changes the real components, optionally as live variants."

export const llmsDetails =
  "Install with `npm i -D stageboard`, then `npx stageboard skill` installs an agent skill. Stories are `*.stories.tsx`; variants are `*.variant.tsx`; flows live in `stageboard/board.json`. Agents check their work with `npx stageboard shot` and the MCP server."

export const siteDescription =
  "Every screen and flow of your React app on one board. Point at what's wrong, your agent fixes the code."
