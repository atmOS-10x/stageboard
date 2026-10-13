# Building the site map

## Enumerate the app

1. List every route: `app/**/page.tsx`, router config or the nav. Group them by area (marketing, auth, dashboard, settings, admin and so on).
2. For each area, note the navigation between pages (sidebar links, buttons to detail pages, tabs). These become `links`.

## A page story

```tsx
export default { title: "App/Dashboard", parameters: { layout: "fullscreen" } } satisfies Meta

export const Tickets: Story = {
  render: () => <TicketsPage />,
  decorators: [(S) => <MockDashboard><S /></MockDashboard>],
  parameters: {
    page: {
      route: "/[practice_id]/dashboard/tickets",
      title: "Tickets",
      group: "dashboard",
      links: ["/[practice_id]/dashboard/tickets/[id]", "/[practice_id]/dashboard/patients"],
    },
  },
}
```

- **`route`:** the real route pattern, with dynamic segments in brackets. `links` match against it.
- **`group`:** one column on the canvas. Use the same group names across the app.
- **Tabs and states of one page:** write extra stories without `page`, or with the same route; they stay in the catalog.
- **Redirect-only pages:** render the page's real UI if it has any. Otherwise skip it.
- **Server components:** render the client part with the data they would receive, or copy the markup and say so in a comment.

## Workflow

Go one area at a time:
1. Write the area's page stories.
2. Shoot every one at 1440 wide and look at each.
3. Fix missing mocks until the page looks like the real app with data.

At the end, run `npx stageboard list` and shoot every page story in a loop. Report any that are weak, and why.

## In-app inspector

```tsx
// a dev-only client component, loaded lazily from the root layout
"use client"
import "@/stageboard.variants"
import { StageboardDevtools } from "stageboard/react"
export default function Dev() { return <StageboardDevtools base="/__stageboard" /> }
```

Proxy `/__stageboard/:path*` to `http://localhost:${STAGEBOARD_PORT}` in development (Next: `rewrites()`; Vite: `server.proxy`).
