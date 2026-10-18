#!/usr/bin/env node
// stageboard's agent (site/stageboard.config.ts, copied from atmos-health): starts each Inspect note as an atmOS Agent Session on this Machine,
// in the git worktree the bridge runs in, on Claude Code with Opus 5.5 and the connected Claude subscription that
// has the most left. Nothing to configure: the runtime and org come from this Machine's atmOS link, the CLI
// profile from the one signed in to that origin, the Project from the Checkout that holds this worktree.
import { execFile, execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname } from "node:path"

const HARNESS = "claude_local"
const MODEL = "claude-opus-5-5"
const PERMISSIONS = "auto"

const flags = []
function atmos(args) {
  return new Promise((resolve, reject) =>
    execFile("atmos", [...flags, ...args, "--json"], { maxBuffer: 64 << 20 }, (err, stdout, stderr) => {
      let res
      try {
        res = JSON.parse(stdout || stderr)
      } catch {
        return reject(new Error((stderr || stdout || String(err)).trim().slice(0, 300)))
      }
      if (!res.ok) return reject(new Error(res.error?.message ?? stdout.slice(0, 300)))
      resolve(res.data?.body ?? res.data)
    }),
  )
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()

// The user's own login is needed to create sessions on a subscription; the active profile may point elsewhere.
async function signInTo(origin, org) {
  if (!process.env.ATMOS_API_KEY && (await atmos(["whoami"]).catch(() => null))?.base_url !== origin) {
    const { profiles } = await atmos(["profile", "list"])
    const who = await Promise.all(profiles.map((p) => atmos(["--profile", p.name, "whoami"]).catch(() => null)))
    const i = who.findIndex((w) => w?.base_url === origin && w.auth_mode === "user")
    if (i < 0) throw new Error(`No atmos profile is signed in to ${origin}; run atmos login --base-url ${origin}`)
    flags.push("--profile", profiles[i].name)
  }
  flags.push("--org", org)
}

// The Checkout of this Machine whose folder is this worktree or the repository it belongs to.
async function checkoutFor(runtime, worktree, repo) {
  const rank = (c) => (c.runtime_id !== runtime ? -1 : c.working_directory === worktree ? 2 : c.working_directory === repo ? 1 : -1)
  try {
    const { projects } = await atmos(["project", "list"])
    const lists = await Promise.all(projects.map((p) => atmos(["project", "checkouts", "list", p.id]).catch(() => ({ checkouts: [] }))))
    return lists.flatMap((l, i) => l.checkouts.map((c) => ({ ...c, project_id: projects[i].id }))).sort((a, b) => rank(b) - rank(a)).find((c) => rank(c) > 0)
  } catch {
    // A service token cannot list Projects; inside an Agent Session on the same repository, use its Checkout.
    const id = process.env.ATMOS_AGENT_SESSION_ID
    const s = id && (await atmos(["session", "get", id]).catch(() => null))?.session
    if (s?.checkout_id && s.runtime_id === runtime && [worktree, repo].includes(s.working_directory)) return { id: s.checkout_id, project_id: s.project_id }
  }
}

// Claude subscriptions by headroom: the fullest window decides, ready readings before stale ones.
async function subscriptions() {
  const { quotas } = await atmos(["api", "agents", "listSubscriptionUsage"]).catch(() => ({ quotas: [] }))
  const used = (q) => Math.max(0, ...q.windows.map((w) => w.used_percent ?? 0)) + (q.status === "ready" ? 0 : 1000)
  return quotas
    .filter((q) => q.provider === "claude_code" && !q.error_class && q.windows?.length && ["ready", "stale"].includes(q.status))
    .sort((a, b) => used(a) - used(b))
}

const note = readFileSync(process.argv[2] ?? process.env.STAGEBOARD_PROMPT_FILE, "utf8")
const worktree = git("rev-parse", "--show-toplevel")
const repo = dirname(git("rev-parse", "--path-format=absolute", "--git-common-dir"))
const branch = git("branch", "--show-current")
const machine = await atmos(["machine", "status"])
if (!machine.runtime_id) throw new Error("This Machine is not linked to atmOS; run atmos machine link")
await signInTo(machine.origin, machine.org_id)
const checkout = await checkoutFor(machine.runtime_id, worktree, repo)
const asked = note.match(/^(?:What the user asked for|Additional notes): (.+)$/m)?.[1] ?? "Inspect note"
const where = `Work in the git worktree at \`${worktree}\`${branch ? ` (branch \`${branch}\`)` : ""}; the user is watching it live, so do not make another worktree.`
if (!checkout) console.log(`No atmOS Checkout holds ${repo} on this Machine; starting a session without a Project`)

let spawned = false
async function create(sub) {
  const body = {
    title: `stageboard: ${asked}`.slice(0, 80),
    runtime_id: machine.runtime_id,
    ...(checkout && { project_id: checkout.project_id, checkout_id: checkout.id }),
    working_directory: worktree,
    harness: HARNESS,
    harness_model: MODEL,
    harness_permission_mode: PERMISSIONS,
    ...(sub && { harness_credential_mode: "subscription", harness_credential_connection_id: sub.provider_connection_id }),
    initial_turn: { text: `${where}\n\n${note}` },
  }
  try {
    return (await atmos(["api", "agents", "createAgentSession", "--body", JSON.stringify(body)])).session.id
  } catch (e) {
    if (!/session-bound token/.test(e.message)) throw e
  }
  // Run from inside an Agent Session, whose token may not create sessions: start it through that session instead.
  // sessions.spawn places a Project session at the Checkout's root, so the prompt moves it into this worktree.
  const input = {
    prompt: `${where} Move into it first with the worktree_enter tool (branch \`${branch}\`, create false).\n\n${note}`,
    ...(checkout ? { project: checkout.project_id, checkout: checkout.id } : { machine_id: machine.runtime_id, working_directory: worktree }),
    harness: HARNESS,
    model: MODEL,
    ...(sub && { subscription: sub.provider_connection_id }),
    check_in_every_minutes: 0,
  }
  spawned = true
  const out = await atmos(["session", "tools", "call", "sessions.spawn", "--input", JSON.stringify(input), "--idempotency-key", randomUUID()])
  return out.result.child_session_id
}

let id
for (const sub of [...(await subscriptions()), null]) {
  try {
    id = await create(sub)
    console.log(sub ? `Subscription ${sub.provider_connection_id} (${sub.windows.map((w) => `${w.kind} ${Math.round(w.used_percent)}%`).join(", ")} used)` : "On this Machine's own Claude login")
    break
  } catch (e) {
    if (!sub || !/subscription|account|credential|quota|limit/i.test(e.message)) throw e
    console.log(`Subscription ${sub.provider_connection_id} refused: ${e.message.slice(0, 160)}`)
  }
}
console.log(`atmOS session ${id}`)

let cancelled = false
process.on("SIGTERM", () => {
  cancelled = true
  execFile("atmos", [...flags, "session", "cancel", id], () => process.exit(1))
})
// The first turn's result, terminal once it finished. A session-bound token reads only its own children, through
// the session's sessions.status tool.
const result = async () =>
  spawned
    ? (await atmos(["session", "tools", "call", "sessions.status", "--input", JSON.stringify({ child_session_id: id })])).result
    : await atmos(["api", "agents", "getAgentSessionResult", "--path", `id=${id}`])
let last = ""
while (!cancelled) {
  await new Promise((r) => setTimeout(r, 5000))
  const r = await result().catch((e) => console.log(`Poll failed: ${e.message.slice(0, 160)}`))
  if (!r) continue
  if (r.status !== last) console.log(`atmOS status: ${r.status}`)
  last = r.status
  if (r.status === "completed" && r.terminal !== false) process.exit(0)
  if (/fail|error|cancel|closed|archived|expired/.test(r.status)) process.exit(1)
}
