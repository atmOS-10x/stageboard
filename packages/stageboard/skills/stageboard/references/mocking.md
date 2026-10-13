# Mocking an app so every page renders

The goal: any page renders inside its real layout with believable data, with no backend, login or websockets.

## 1. Providers (preview.tsx)

List the providers in the app's root layout and decide for each one:
- **Keep** pure UI providers: theme, query client (with `retry: false`), i18n, URL state adapters.
- **Replace** anything that authenticates, opens sockets or redirects: provide the same React context with a static value. Export a `MockAuthProvider` with logged-out and logged-in presets.
- **Skip** guards that redirect to login. Render the layout's inner component, or provide the context they read so they pass.

Keep two wrappers: `MockProviders` (public pages) and `MockDashboard` (logged in, inside the real app layout). Page stories pick one with `decorators`.

## 2. The HTTP layer

Mock at the client, not per component:
- **axios:** install a custom `adapter` on every instance (`instance.defaults.adapter = mockAdapter`).
- **fetch:** wrap `window.fetch` for same-origin API paths.
- **Generated clients** (OpenAPI, Rapini, orval and similar): key handlers by operation name so they are typed, e.g. `mockApi({ getTickets: () => tickets })`. Parse the generated client once to map method and path to operation.
- **Unknown endpoints** must return an empty value of the right shape (`[]` or `{}`) and `console.warn` once. A page must never hang on a loader.
- **Per-story overrides:** `MockDashboard mocks={{ getTicket: () => urgentTicket }}`.

## 3. Fixtures

- Write factories (`makePatient`, `makeTicket`) that fill every required field, so fixtures only spell out what matters.
- Use one coherent fictional world, with names, dates relative to "now", statuses spread across their states, and enough rows to look real (around 20). Keep it consistent across pages: the ticket on the inbox is the same one on the detail page.
- Turn on all feature flags except realtime transports. Prefer the polling paths.

## 4. Things that commonly break

| symptom | fix |
|---|---|
| `X must be used within Provider` | provide that context in the decorator |
| infinite loader | an endpoint has no mock and returned undefined; add a schema-shaped empty response |
| redirect to login or another page | `next/navigation` and `router.push` are shimmed; block guards via context, not by editing them |
| render loop | a hook depends on an unstable mock object; memoise the mock value |
| missing images or fonts | assets under `public/` are served at `/`; fonts via `next/font` are shimmed |
| "Failed to resolve import" for a directory | stageboard's Next preset resolves `dir/index.ts`; otherwise add an alias |
