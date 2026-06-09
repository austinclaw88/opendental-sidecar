# Frontend

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15 | Framework (App Router) |
| React | 19 | UI library |
| Tailwind CSS | 4 | Styling |
| shadcn/ui | latest | Component library |
| Lucide | latest | Icons |

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `hsl(160 65% 26%)` — Pine Green | Buttons, links, accents |
| Background | `hsl(210 40% 98%)` — Slate 50 | Page background |
| Card | `hsl(0 0% 100%)` | Card backgrounds |
| Text | `hsl(222 47% 11%)` — Slate 900 | Body text |
| Accent | `hsl(190 90% 36%)` — Cyan 600 | Secondary accents |

**Typography:** Inter (system sans-serif)

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `page.tsx` | Patient Search — search bar + results list |
| `/patients/{patNum}` | `patients/[patNum]/page.tsx` | Patient Profile — demographics, insurance, tabs for appts/procs/claims |
| `/appointments` | `appointments/page.tsx` | Appointments — enter patient num to view |
| `/procedures` | `procedures/page.tsx` | Procedures — enter patient num to view |
| `/claims` | `claims/page.tsx` | Claims — enter patient num to view |
| `/claims/{claimNum}` | `claims/[claimNum]/page.tsx` | Claim Detail — full breakdown with line items |

## Layout

- **Sidebar** — fixed left, navigation links + brand logo
- **Content** — scrollable main area, max-width 7xl, padding 6

## API Client

All API calls go through `src/lib/api.ts`. Uses relative URLs (`/api/v1/...`) which Next.js rewrites proxy to the backend.

## Status Badges

Color-coded badge components for each entity status. Applied CSS classes:
- `badge-scheduled` — blue
- `badge-complete` — green
- `badge-cancelled` — red
- `badge-broken` — orange
- `badge-sent` — cyan
- `badge-received` — emerald
- `badge-denied` — rose
- `badge-estimate` — purple
- `badge-tp` — amber
- `badge-patient` — green
- `badge-inactive` — gray

## Files

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout with sidebar |
| `src/app/globals.css` | Design system CSS variables |
| `src/lib/api.ts` | API client + TypeScript interfaces |
| `src/lib/utils.ts` | Utility functions (cn, etc.) |
| `src/components/layout/sidebar.tsx` | Navigation sidebar |
| `src/components/ui/` | shadcn/ui components (button, card, table, etc.) |
