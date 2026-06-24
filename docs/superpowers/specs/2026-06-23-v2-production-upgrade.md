# Competitive Intelligence Agent — v2 Production Upgrade

**Date:** 2026-06-23
**Status:** Approved

---

## Problem

The v1 MVP is functional but not production-ready. It has four blockers preventing real-world daily use:

1. **Auth is bare-bones** — no OAuth, no forgot password, no password toggle, no sign out. Companies won't adopt a tool they can't easily access.
2. **UI reads like a prototype** — gray backgrounds, unreadable text hierarchy, no empty states, auto-seeded fake competitors pollute the dashboard on first login.
3. **Manual-only triggers** — users must click "Generate Briefing" themselves. A daily intelligence tool needs to run automatically.
4. **Not deployed** — the app lives only on localhost. It needs to be on GitHub and live on Vercel.

---

## What We're Building

A production-quality upgrade that ships a polished, deployed, daily-use competitive intelligence platform:

- Auth that companies trust (Google OAuth, password recovery, sign out)
- A professional UI companies would pay for (sidebar layout, proper design system, real empty states)
- Automated daily briefings via Vercel Cron (no manual trigger required)
- Change detection so signals are only flagged when content actually changes
- News deduplication so the same article never appears twice
- High-severity email alerts sent immediately when urgent signals are detected
- Live on Vercel, source on GitHub

---

## Stack

Unchanged from v1. All free tiers:

| Layer | Tool |
|---|---|
| Framework | Next.js 16.2.9 App Router (TypeScript, React 19) |
| Auth + DB | Supabase (free tier) |
| Web scraping | Jina AI Reader (`r.jina.ai`) |
| News | Google News RSS |
| AI synthesis | Groq API — Llama 3.3 70B |
| Email | Resend sandbox (`onboarding@resend.dev`) |
| Hosting | Vercel Hobby |

**New additions:**
- Google OAuth via Supabase (free, no account fee)
- `NEXT_PUBLIC_SITE_URL` env var for correct OAuth redirect URLs across environments

**Dropped:** Apple OAuth — requires Apple Developer account ($99/year, not free).

---

## Schema Changes

Run these in Supabase SQL Editor after deploying:

```sql
-- Change detection: store SHA-256 hash of scraped content
ALTER TABLE signals ADD COLUMN IF NOT EXISTS content_hash text;

-- Index for fast hash lookups
CREATE INDEX IF NOT EXISTS signals_competitor_hash
  ON signals(competitor_id, content_hash);

-- News deduplication: track which URLs have been processed per workspace
CREATE TABLE IF NOT EXISTS processed_news_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, url)
);

-- RLS for processed_news_urls
ALTER TABLE processed_news_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON processed_news_urls
  USING (workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  ));
```

---

## Architecture Changes

### New files
```
app/(auth)/forgot-password/page.tsx     — send reset email form
app/(auth)/reset-password/page.tsx      — new password form (Supabase magic link lands here)
app/(auth)/auth/callback/route.ts       — OAuth + magic link exchange handler
app/api/cron/daily-brief/route.ts       — Vercel Cron endpoint
lib/hash.ts                             — SHA-256 content hashing utility
lib/config.ts                           — siteUrl constant (NEXT_PUBLIC_SITE_URL)
lib/supabase/types.ts                   — add ProcessedNewsUrl type
```

### Modified files
```
app/(auth)/login/page.tsx               — Google OAuth button, forgot password link, password toggle
app/(auth)/signup/page.tsx              — Google OAuth button, password toggle
app/(app)/layout.tsx                    — sidebar layout, user menu with sign out
app/(app)/dashboard/page.tsx            — remove seed data, add empty state
app/(app)/competitors/page.tsx          — redesigned with sidebar layout
app/(app)/briefings/page.tsx            — redesigned list
app/(app)/briefings/[id]/page.tsx       — redesigned detail
components/GenerateButton.tsx           — redesigned progress UI (animated steps)
components/BriefingItemCard.tsx         — severity-colored left border, redesigned
components/AddCompetitorForm.tsx        — redesigned
components/CompetitorList.tsx           — favicon fetching, redesigned
app/api/analyze/route.ts                — add change detection + news dedup
lib/synthesizer.ts                      — unchanged
lib/news.ts                             — unchanged
lib/scraper.ts                          — unchanged
lib/email.ts                            — add high-severity alert email template
vercel.json                             — add daily-brief cron
db/schema.sql                           — add new tables/columns
```

---

## Section 1: Auth & Access

### Google OAuth
Supabase supports Google OAuth via Settings → Auth → Providers → Google. Requires a Google Cloud project with OAuth credentials (free). The callback URL is `{SITE_URL}/auth/callback`.

`app/(auth)/auth/callback/route.ts` handles the code exchange:
```ts
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

### Forgot Password
`app/(auth)/forgot-password/page.tsx` — client component with email input. Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${siteUrl}/auth/callback?next=/reset-password\` })`. Shows "Check your email" confirmation.

`app/(auth)/reset-password/page.tsx` — client component. Calls `supabase.auth.updateUser({ password: newPassword })`. Redirects to `/dashboard` on success.

### Password Visibility Toggle
Both login and signup password fields get an eye icon button (Heroicons `EyeIcon` / `EyeSlashIcon` — or inline SVG to avoid adding a dependency). Toggle switches `input type` between `"password"` and `"text"`.

### Sign Out
`app/(app)/layout.tsx` user menu includes a "Sign out" button. It calls a server action or client-side `supabase.auth.signOut()` then `router.push('/login')`.

### Remove Seed Data
Delete lines 32–40 in `app/(app)/dashboard/page.tsx` (the `if (count === 0)` block that inserts Notion/Linear/Asana). Replace with an empty state component when `competitors.length === 0`.

### proxy.ts auth paths
Add `/forgot-password`, `/reset-password`, and `/auth` to `isAuthPath` so they are not redirect-guarded.

---

## Section 2: UI/UX Redesign

### Layout
Replace the current top-nav layout with a two-zone layout:
- **Left sidebar** (240px, fixed, white, `border-r border-gray-200`): IntelAgent logo at top, nav links in middle, user menu at bottom
- **Main content** (`ml-[240px]`, `bg-gray-50`, `min-h-screen`): page content with `max-w-5xl mx-auto px-8 py-10`

Sidebar nav links: Dashboard, Competitors, Briefings. Active link: `bg-indigo-50 text-indigo-700 font-medium`. Inactive: `text-gray-600 hover:bg-gray-100`.

User menu at sidebar bottom: shows avatar circle (initials from email), email truncated, "Sign out" button below.

### Design System
- **Primary accent:** indigo-600 (`#4F46E5`)
- **Background:** gray-50 (`#F9FAFB`) content, white cards
- **Text hierarchy:** gray-900 headings, gray-700 body, gray-500 meta/labels, gray-400 placeholders
- **Cards:** white, `rounded-xl border border-gray-200 shadow-sm`
- **Buttons:** primary = `bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg px-4 py-2`; secondary = `bg-white border border-gray-200 text-gray-700 hover:bg-gray-50`

### Severity Badges & Cards
Briefing item cards get a 3px left border:
- High: `border-l-red-500`, badge `bg-red-50 text-red-700`
- Medium: `border-l-amber-500`, badge `bg-amber-50 text-amber-700`
- Low: `border-l-gray-300`, badge `bg-gray-100 text-gray-600`

### Competitor List
Each competitor row fetches a favicon: `https://www.google.com/s2/favicons?domain={websiteUrl}&sz=32`. Falls back to a colored initial circle if the favicon 404s (handle via `onError` on `<img>`).

### Empty States
When `competitors.length === 0` on dashboard:
```
[icon: chart-bar or target]
No competitors tracked yet
Add your first competitor to start generating intelligence briefings.
[Add Competitor →]
```

When `briefings.length === 0` on briefings list:
```
[icon: document-text]
No briefings yet
Generate your first briefing from the dashboard.
[Go to Dashboard →]
```

### Streaming Progress UI (GenerateButton)
Replace the plain text list with an animated step sequence:

```
○ Fetching competitor websites...     ← spinning when active, ✓ when done
○ Fetching news coverage...
○ Analyzing signal relevance...
○ Extracting observations...
○ Generating strategic briefing...
```

Each step transitions: gray circle → indigo spinner → green checkmark. Use Tailwind `animate-spin` for the active step.

### Error Handling
Every page wraps its data-fetching in try/catch. API errors return `{ error: string }` JSON with appropriate HTTP status. Client components show inline error banners (`bg-red-50 border border-red-200 text-red-700 rounded-lg p-3`) instead of crashing.

### Auth Pages Redesign
Centered card layout (`max-w-md mx-auto mt-20`), IntelAgent logo above the card, proper field labels, full-width buttons, Google OAuth button with Google icon above the email/password form with an "or" divider.

---

## Section 3: Automated Daily Monitoring

### Vercel Cron
`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/keepalive", "schedule": "0 12 * * *" },
    { "path": "/api/cron/daily-brief", "schedule": "0 9 * * *" }
  ]
}
```

`app/api/cron/daily-brief/route.ts`:
- Protected by `Authorization: Bearer {CRON_SECRET}` header check (Vercel sets this automatically; add `CRON_SECRET` env var)
- Fetches all workspaces
- For each workspace, runs the full scrape → judge → extract → generate pipeline (same logic as `/api/analyze` but without SSE streaming)
- Saves the resulting briefing to DB
- Sends email to workspace owner
- Has `export const maxDuration = 60`

### Change Detection
`lib/hash.ts`:
```ts
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

In the scrape step (both `/api/analyze` and `/api/cron/daily-brief`):
1. Scrape the URL → get `content`
2. Compute `hash = await sha256(content)`
3. Query `signals` for the most recent row where `competitor_id = X AND content_hash = hash`
4. If found → skip (no change). If not found → add to signals as a meaningful candidate.

This means the AI pipeline only sees content that is genuinely new or changed.

### News Deduplication
After fetching Google News RSS items for a competitor:
1. Query `processed_news_urls` for `workspace_id = X AND url IN (fetched urls)`
2. Filter out already-processed URLs
3. Insert new URLs into `processed_news_urls` after successful processing

### High-Severity Email Alerts
After generating a briefing, check `result.items.filter(i => i.severity === 'high')`. If any exist:
- Send a separate alert email immediately (via Resend, same `lib/email.ts`)
- Subject: `Urgent competitive signal: {competitor names}`
- Body: just the high-severity items with observation + interpretation
- This is in addition to (not instead of) the regular daily briefing email

### Cron Secret
Add `CRON_SECRET` to `.env.local` (any random string). Add to Vercel env vars. The cron route checks:
```ts
if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## Section 4: Deployment

### GitHub
1. `git init` in project root
2. Create `.gitignore` (already exists from Next.js scaffold — verify `.env.local` is listed)
3. `git add -A && git commit -m "feat: initial commit — competitive intelligence agent v1+v2"`
4. Create GitHub repo `competitive-intelligence-agent` via `gh repo create`
5. `git push -u origin main`

### Vercel
1. `npx vercel` — link to the GitHub repo
2. Set all env vars via `vercel env add` or Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GROQ_API_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_SITE_URL` = the Vercel deployment URL
   - `CRON_SECRET` = any random string
3. `npx vercel --prod`

### Supabase Auth Config (post-deploy)
In Supabase dashboard → Authentication → URL Configuration:
- **Site URL:** `https://{your-vercel-url}.vercel.app`
- **Redirect URLs:** add `https://{your-vercel-url}.vercel.app/auth/callback`

For Google OAuth (Supabase → Auth → Providers → Google):
- Client ID and Secret from Google Cloud Console (OAuth 2.0 credentials, free)
- Authorized redirect URI: `https://{supabase-project}.supabase.co/auth/v1/callback`

### Site URL constant
Create `lib/config.ts` as the single source for the site URL (used in OAuth redirects and password reset emails):
```ts
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
```
Import `siteUrl` from `@/lib/config` in auth pages and email helpers.

---

## TypeScript Types Addition

```ts
// lib/supabase/types.ts — add:
export interface ProcessedNewsUrl {
  id: string
  workspace_id: string
  url: string
  processed_at: string
}
```

---

## What's Explicitly Out of This Spec

- Apple OAuth (requires $99/year Apple Developer account)
- Team workspaces / invite flow (multi-user)
- Job postings monitoring (careers page scraping)
- Trend analytics / competitor timelines
- Slack integration
- Custom email domain (Resend sandbox covers demo + early usage)
- Mobile-specific design (sidebar collapses gracefully but not a full mobile nav)
