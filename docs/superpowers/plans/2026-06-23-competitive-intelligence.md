# Competitive Intelligence Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a demo-ready multi-tenant web app that monitors competitor websites and news, then streams a 3-layer AI-generated strategic briefing to the user in real time.

**Architecture:** Next.js 14 App Router (TypeScript) with Supabase for auth and Postgres, a Groq-powered 3-layer synthesis pipeline (judge → observe → interpret), and a streaming Route Handler that pushes SSE progress events to the client via `ReadableStream`. No background job queue — everything is manually triggered for the demo.

**Tech Stack:** Next.js 14, TypeScript, Supabase (`@supabase/ssr`), Groq SDK (`groq-sdk`, Llama 3.3 70B), `fast-xml-parser`, Resend, Tailwind CSS, Vitest

## Global Constraints

- Node.js 20+
- All services use free tiers only — Supabase, Groq, Resend sandbox, Vercel Hobby
- No credit card required for any service
- TypeScript strict mode throughout (`"strict": true` in tsconfig)
- Tailwind CSS for all styling — no component library
- No Inngest, no background jobs — manual trigger only for v1
- Groq model: `llama-3.3-70b-versatile`
- Jina AI Reader base URL: `https://r.jina.ai/`
- Google News RSS base URL: `https://news.google.com/rss/search`

---

## File Structure

```
/
├── app/
│   ├── layout.tsx                        — root layout, Tailwind globals
│   ├── page.tsx                          — redirect to /dashboard or /login
│   ├── (auth)/
│   │   ├── login/page.tsx                — email/password sign-in form
│   │   └── signup/page.tsx               — email/password sign-up form
│   └── (app)/
│       ├── layout.tsx                    — auth guard: redirect to /login if no session
│       ├── dashboard/page.tsx            — competitor list + Generate button + latest briefing card
│       ├── competitors/page.tsx          — add/list/delete competitors
│       └── briefings/
│           ├── page.tsx                  — briefing history list
│           └── [id]/page.tsx             — briefing detail (executive summary + items)
├── app/api/
│   ├── analyze/route.ts                  — POST: SSE stream (scrape → synthesize → save)
│   ├── competitors/
│   │   ├── route.ts                      — GET list, POST create
│   │   └── [id]/route.ts                — DELETE
│   └── briefings/
│       ├── route.ts                      — GET list
│       ├── [id]/route.ts                — GET single with items
│       └── [id]/email/route.ts          — POST send email via Resend
├── components/
│   ├── AddCompetitorForm.tsx             — controlled form, calls POST /api/competitors
│   ├── CompetitorList.tsx                — renders competitor rows with delete button
│   ├── GenerateButton.tsx                — triggers /api/analyze, renders SSE progress
│   ├── BriefingCard.tsx                  — summary card for briefing list
│   └── BriefingItemCard.tsx             — single briefing item: observation + interpretation
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     — createBrowserClient (client components)
│   │   ├── server.ts                     — createServerClient (server components + route handlers)
│   │   └── types.ts                      — manual TypeScript types matching DB schema
│   ├── scraper.ts                        — Jina AI Reader fetch wrapper
│   ├── news.ts                           — Google News RSS parser
│   ├── synthesizer.ts                    — 3-layer Groq pipeline: judge, observe, interpret
│   └── email.ts                          — Resend wrapper
├── lib/__tests__/
│   ├── scraper.test.ts
│   ├── news.test.ts
│   └── synthesizer.test.ts
├── db/
│   └── schema.sql                        — all CREATE TABLE + RLS policies
├── middleware.ts                          — Supabase session refresh + route protection
├── .env.local.example
└── vitest.config.ts
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json` (via `create-next-app`)
- Create: `.env.local.example`
- Create: `vitest.config.ts`
- Create: `lib/__tests__/.gitkeep`

**Interfaces:**
- Produces: runnable Next.js dev server at `localhost:3000`, passing `vitest` run

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"
```

When prompted: answer **No** to all optional features (Turbopack, etc.).

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr groq-sdk fast-xml-parser resend
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create .env.local.example**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GROQ_API_KEY=gsk_your-groq-key
RESEND_API_KEY=re_your-resend-key
```

Copy to `.env.local` and fill in values (from Supabase dashboard → Settings → API, and groq.com, resend.com).

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: server running at `http://localhost:3000` with no errors.

- [ ] **Step 6: Verify vitest runs**

```bash
npx vitest run
```

Expected: `No test files found` (no failures).

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: initial Next.js project setup with Vitest"
```

---

## Task 2: Database Schema

**Files:**
- Create: `db/schema.sql`

**Interfaces:**
- Produces: Supabase Postgres tables with RLS; all later tasks depend on this schema

- [ ] **Step 1: Create schema file**

Create `db/schema.sql`:

```sql
-- workspaces: one per user (v1 has no team invites)
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON workspaces
  FOR ALL USING (owner_id = auth.uid());

-- competitors tracked by a workspace
CREATE TABLE competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  website_url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON competitors
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- raw scraped content and news items
CREATE TABLE signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('website', 'news')),
  raw_content text NOT NULL,
  url text NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  is_meaningful boolean
);

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON signals
  FOR ALL USING (
    competitor_id IN (
      SELECT c.id FROM competitors c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- one briefing per generation run
CREATE TABLE briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  generated_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'complete', 'error')),
  executive_summary text
);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON briefings
  FOR ALL USING (
    workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
  );

-- individual insight cards inside a briefing
CREATE TABLE briefing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  competitor_id uuid NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  category text NOT NULL,
  observation text NOT NULL,
  interpretation text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  source_urls text[] DEFAULT '{}'
);

ALTER TABLE briefing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_owner_all" ON briefing_items
  FOR ALL USING (
    briefing_id IN (
      SELECT id FROM briefings WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );
```

- [ ] **Step 2: Run schema in Supabase**

Go to Supabase Dashboard → SQL Editor → paste the entire `db/schema.sql` content → Run.

Expected: all five `CREATE TABLE` statements succeed with no errors.

- [ ] **Step 3: Verify tables in Table Editor**

In Supabase Dashboard → Table Editor, confirm these tables exist: `workspaces`, `competitors`, `signals`, `briefings`, `briefing_items`.

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql
git commit -m "feat: add database schema with RLS policies"
```

---

## Task 3: Supabase Auth + Middleware

**Files:**
- Create: `lib/supabase/types.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/signup/page.tsx`
- Create: `app/(app)/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `createClient()` (browser), `createServerClient()` (server); auth-protected `(app)` routes

- [ ] **Step 1: Create TypeScript types**

Create `lib/supabase/types.ts`:

```typescript
export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Competitor {
  id: string
  workspace_id: string
  name: string
  website_url: string
  description: string | null
  created_at: string
}

export interface Signal {
  id: string
  competitor_id: string
  source_type: 'website' | 'news'
  raw_content: string
  url: string
  fetched_at: string
  is_meaningful: boolean | null
}

export interface Briefing {
  id: string
  workspace_id: string
  generated_at: string
  status: 'generating' | 'complete' | 'error'
  executive_summary: string | null
}

export interface BriefingItem {
  id: string
  briefing_id: string
  competitor_id: string
  category: string
  observation: string
  interpretation: string
  severity: 'high' | 'medium' | 'low'
  source_urls: string[]
}
```

- [ ] **Step 2: Create browser Supabase client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create server Supabase client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 4: Create middleware**

Create `middleware.ts` in the project root:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPath = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup')

  if (!user && !isAuthPath && request.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico).*)'],
}
```

- [ ] **Step 5: Create root redirect**

Replace `app/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/dashboard' : '/login')
}
```

- [ ] **Step 6: Create app layout with auth guard**

Create `app/(app)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
```

- [ ] **Step 7: Create login page**

Create `app/(auth)/login/page.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          No account? <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Create signup page**

Create `app/(auth)/signup/page.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { company_name: name } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text" placeholder="Company name" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            type="password" placeholder="Password (min 6 chars)" value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            required minLength={6}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Verify auth flow**

```bash
npm run dev
```

1. Go to `http://localhost:3000` — expect redirect to `/login`
2. Click "Sign up" → create an account with a real email
3. Expect redirect to `/dashboard` (page will 404 for now, that's fine)
4. Go to `/login` — expect redirect to `/dashboard` (already signed in)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add Supabase auth, middleware, login and signup pages"
```

---

## Task 4: Workspace Seed + Competitor CRUD API

**Files:**
- Create: `app/api/workspace/route.ts`
- Create: `app/api/competitors/route.ts`
- Create: `app/api/competitors/[id]/route.ts`

**Interfaces:**
- Consumes: `createServerClient()` from `@/lib/supabase/server`; `Workspace`, `Competitor` from `@/lib/supabase/types`
- Produces:
  - `GET /api/workspace` → `{ workspace: Workspace }`
  - `GET /api/competitors` → `{ competitors: Competitor[] }`
  - `POST /api/competitors` body `{ name, website_url, description? }` → `{ competitor: Competitor }`
  - `DELETE /api/competitors/[id]` → `{ success: true }`

- [ ] **Step 1: Create workspace route (auto-creates workspace on first call)**

Create `app/api/workspace/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return existing workspace or create one
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) {
    const companyName = user.user_metadata?.company_name ?? 'My Company'
    const { data: created, error } = await supabase
      .from('workspaces')
      .insert({ name: companyName, owner_id: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    workspace = created
  }

  return NextResponse.json({ workspace })
}
```

- [ ] **Step 2: Create competitors list + create route**

Create `app/api/competitors/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ competitors: [] })

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ competitors: competitors ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, website_url, description } = await request.json()
  if (!name || !website_url) {
    return NextResponse.json({ error: 'name and website_url are required' }, { status: 400 })
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const { data: competitor, error } = await supabase
    .from('competitors')
    .insert({ workspace_id: workspace.id, name, website_url, description: description ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ competitor }, { status: 201 })
}
```

- [ ] **Step 3: Create competitor delete route**

Create `app/api/competitors/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Verify API routes**

```bash
npm run dev
```

In the browser console (after signing in), run:

```javascript
// Create a competitor
const r = await fetch('/api/competitors', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Notion', website_url: 'https://notion.so/pricing' })
})
const d = await r.json()
console.log(d) // { competitor: { id: '...', name: 'Notion', ... } }
```

- [ ] **Step 5: Commit**

```bash
git add app/api/
git commit -m "feat: add workspace auto-create and competitor CRUD API routes"
```

---

## Task 5: Scraper Utility

**Files:**
- Create: `lib/scraper.ts`
- Create: `lib/__tests__/scraper.test.ts`

**Interfaces:**
- Produces: `scrapeUrl(url: string): Promise<string>` — returns page content as markdown

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/scraper.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scrapeUrl } from '../scraper'

describe('scrapeUrl', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('calls Jina reader with the target URL and returns markdown', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Pricing\n\nEnterprise: $99/mo'),
    })

    const result = await scrapeUrl('https://example.com/pricing')

    expect(fetch).toHaveBeenCalledWith(
      'https://r.jina.ai/https://example.com/pricing',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'text/markdown' }),
      })
    )
    expect(result).toBe('# Pricing\n\nEnterprise: $99/mo')
  })

  it('throws an error when Jina returns a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    await expect(scrapeUrl('https://example.com')).rejects.toThrow('Scrape failed: 429')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/scraper.test.ts
```

Expected: FAIL — `Cannot find module '../scraper'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/scraper.ts`:

```typescript
export async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      Accept: 'text/markdown',
      'X-Return-Format': 'markdown',
    },
  })
  if (!response.ok) throw new Error(`Scrape failed: ${response.status}`)
  return response.text()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/__tests__/scraper.test.ts
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/scraper.ts lib/__tests__/scraper.test.ts
git commit -m "feat: add Jina AI Reader scraper utility"
```

---

## Task 6: News Parser

**Files:**
- Create: `lib/news.ts`
- Create: `lib/__tests__/news.test.ts`

**Interfaces:**
- Produces: `fetchNews(companyName: string): Promise<NewsItem[]>`
- Produces: `interface NewsItem { title: string; link: string; description: string; pubDate: string }`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/news.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchNews } from '../news'

const recentDate = new Date().toUTCString()
const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toUTCString()

const MOCK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Google News</title>
    <item>
      <title>Notion raises $100M Series C</title>
      <link>https://techcrunch.com/notion-series-c</link>
      <description>Notion announced a major funding round.</description>
      <pubDate>${recentDate}</pubDate>
    </item>
    <item>
      <title>Old Notion news from last month</title>
      <link>https://techcrunch.com/old</link>
      <description>Stale news item.</description>
      <pubDate>${oldDate}</pubDate>
    </item>
  </channel>
</rss>`

describe('fetchNews', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(MOCK_RSS),
    })
  })

  it('builds the correct Google News RSS URL for the company name', async () => {
    await fetchNews('Notion')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('news.google.com/rss/search?q=Notion')
    )
  })

  it('returns only news items from the last 7 days', async () => {
    const items = await fetchNews('Notion')
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Notion raises $100M Series C')
  })

  it('maps items to the NewsItem shape', async () => {
    const items = await fetchNews('Notion')
    expect(items[0]).toMatchObject({
      title: expect.any(String),
      link: expect.any(String),
      description: expect.any(String),
      pubDate: expect.any(String),
    })
  })

  it('throws when RSS fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchNews('Notion')).rejects.toThrow('News fetch failed: 500')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/__tests__/news.test.ts
```

Expected: FAIL — `Cannot find module '../news'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/news.ts`:

```typescript
import { XMLParser } from 'fast-xml-parser'

export interface NewsItem {
  title: string
  link: string
  description: string
  pubDate: string
}

export async function fetchNews(companyName: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(companyName)
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`

  const response = await fetch(url)
  if (!response.ok) throw new Error(`News fetch failed: ${response.status}`)

  const xml = await response.text()
  const parser = new XMLParser({ ignoreAttributes: false })
  const parsed = parser.parse(xml)
  const rawItems = parsed?.rss?.channel?.item ?? []
  const items: unknown[] = Array.isArray(rawItems) ? rawItems : [rawItems]

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  return items
    .filter((item: any) => new Date(item.pubDate).getTime() > sevenDaysAgo)
    .map((item: any) => ({
      title: String(item.title ?? ''),
      link: String(item.link ?? ''),
      description: String(item.description ?? ''),
      pubDate: String(item.pubDate ?? ''),
    }))
    .slice(0, 10)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run lib/__tests__/news.test.ts
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/news.ts lib/__tests__/news.test.ts
git commit -m "feat: add Google News RSS parser"
```

---

## Task 7: Groq Synthesis Pipeline

**Files:**
- Create: `lib/synthesizer.ts`
- Create: `lib/__tests__/synthesizer.test.ts`

**Interfaces:**
- Consumes: `GROQ_API_KEY` env var; `Competitor` from `@/lib/supabase/types`
- Produces:
  - `interface RawSignal { competitor_id: string; competitor_name: string; source_type: 'website' | 'news'; raw_content: string; url: string }`
  - `interface JudgedSignal extends RawSignal { is_meaningful: boolean; category: string }`
  - `interface StructuredObservation { competitor_id: string; competitor_name: string; what_changed: string; evidence: string; category: string; severity: 'high' | 'medium' | 'low' }`
  - `interface BriefingResult { executive_summary: string; items: BriefingResultItem[] }`
  - `interface BriefingResultItem { competitor_name: string; competitor_id: string; observation: string; interpretation: string; category: string; severity: 'high' | 'medium' | 'low' }`
  - `judgeSignals(signals: RawSignal[]): Promise<JudgedSignal[]>`
  - `extractObservations(signals: JudgedSignal[], competitors: Competitor[]): Promise<StructuredObservation[]>`
  - `generateBriefing(observations: StructuredObservation[], competitors: Competitor[]): Promise<BriefingResult>`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/synthesizer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock groq-sdk before importing synthesizer
const mockCreate = vi.fn()
vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { judgeSignals, extractObservations, generateBriefing, type RawSignal } from '../synthesizer'
import type { Competitor } from '../supabase/types'

const mockCompetitor: Competitor = {
  id: 'comp-1',
  workspace_id: 'ws-1',
  name: 'Notion',
  website_url: 'https://notion.so/pricing',
  description: null,
  created_at: new Date().toISOString(),
}

const mockSignal: RawSignal = {
  competitor_id: 'comp-1',
  competitor_name: 'Notion',
  source_type: 'website',
  raw_content: 'Enterprise plan now $16/seat/month, down from $20',
  url: 'https://notion.so/pricing',
}

function groqResponse(content: string) {
  return { choices: [{ message: { content } }] }
}

describe('judgeSignals', () => {
  it('returns empty array for empty input', async () => {
    const result = await judgeSignals([])
    expect(result).toEqual([])
  })

  it('marks signals as meaningful when Groq says so', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({ signals: [{ is_meaningful: true, category: 'pricing' }] }))
    )
    const result = await judgeSignals([mockSignal])
    expect(result[0].is_meaningful).toBe(true)
    expect(result[0].category).toBe('pricing')
  })

  it('marks signals as not meaningful when Groq says so', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({ signals: [{ is_meaningful: false, category: 'other' }] }))
    )
    const result = await judgeSignals([mockSignal])
    expect(result[0].is_meaningful).toBe(false)
  })
})

describe('extractObservations', () => {
  it('returns empty array when no meaningful signals', async () => {
    const result = await extractObservations([], [mockCompetitor])
    expect(result).toEqual([])
  })

  it('extracts structured observations from meaningful signals', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({
        observations: [{
          what_changed: 'Enterprise pricing dropped from $20 to $16 per seat',
          evidence: 'Enterprise plan now $16/seat/month, down from $20',
          category: 'pricing',
          severity: 'high',
        }]
      }))
    )
    const judged = [{ ...mockSignal, is_meaningful: true, category: 'pricing' }]
    const result = await extractObservations(judged, [mockCompetitor])
    expect(result[0].what_changed).toContain('pricing')
    expect(result[0].severity).toBe('high')
    expect(result[0].competitor_id).toBe('comp-1')
  })
})

describe('generateBriefing', () => {
  it('returns executive summary and items', async () => {
    mockCreate.mockResolvedValue(
      groqResponse(JSON.stringify({
        executive_summary: 'Notion cut enterprise pricing — likely a competitive response.',
        items: [{
          competitor_name: 'Notion',
          observation: 'Dropped enterprise from $20 to $16/seat',
          interpretation: 'Likely responding to Coda and Linear undercutting on price.',
          category: 'pricing',
          severity: 'high',
        }]
      }))
    )
    const obs = [{
      competitor_id: 'comp-1',
      competitor_name: 'Notion',
      what_changed: 'Dropped enterprise from $20 to $16/seat',
      evidence: 'Enterprise plan now $16/seat/month',
      category: 'pricing',
      severity: 'high' as const,
    }]
    const result = await generateBriefing(obs, [mockCompetitor])
    expect(result.executive_summary).toContain('Notion')
    expect(result.items[0].competitor_id).toBe('comp-1')
    expect(result.items[0].interpretation).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/synthesizer.test.ts
```

Expected: FAIL — `Cannot find module '../synthesizer'`

- [ ] **Step 3: Write the synthesizer implementation**

Create `lib/synthesizer.ts`:

```typescript
import Groq from 'groq-sdk'
import type { Competitor } from './supabase/types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export interface RawSignal {
  competitor_id: string
  competitor_name: string
  source_type: 'website' | 'news'
  raw_content: string
  url: string
}

export interface JudgedSignal extends RawSignal {
  is_meaningful: boolean
  category: string
}

export interface StructuredObservation {
  competitor_id: string
  competitor_name: string
  what_changed: string
  evidence: string
  category: string
  severity: 'high' | 'medium' | 'low'
}

export interface BriefingResultItem {
  competitor_name: string
  competitor_id: string
  observation: string
  interpretation: string
  category: string
  severity: 'high' | 'medium' | 'low'
}

export interface BriefingResult {
  executive_summary: string
  items: BriefingResultItem[]
}

// ── Layer 1: Signal Judge ──────────────────────────────────────────────────

export async function judgeSignals(signals: RawSignal[]): Promise<JudgedSignal[]> {
  if (signals.length === 0) return []

  const BATCH = 8
  const results: JudgedSignal[] = []
  for (let i = 0; i < signals.length; i += BATCH) {
    const batch = signals.slice(i, i + BATCH)
    const judged = await judgeSignalBatch(batch)
    results.push(...judged)
  }
  return results
}

async function judgeSignalBatch(signals: RawSignal[]): Promise<JudgedSignal[]> {
  const prompt = `You are a competitive intelligence analyst. Determine if each signal is meaningful.

${signals.map((s, i) =>
  `[${i}] Company: ${s.competitor_name} | Type: ${s.source_type}
Content: ${s.raw_content.slice(0, 600)}`
).join('\n\n')}

Respond with JSON: {"signals": [{"is_meaningful": boolean, "category": "pricing"|"product"|"hiring"|"news"|"positioning"|"other"}]}
One entry per signal, same order. Meaningful = shows pricing changes, new features, strategic news, or hiring patterns. Not meaningful = generic marketing, boilerplate, unchanged content.`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  let parsed: { signals: Array<{ is_meaningful: boolean; category: string }> }
  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    parsed = { signals: signals.map(() => ({ is_meaningful: false, category: 'other' })) }
  }

  return signals.map((s, i) => ({
    ...s,
    is_meaningful: parsed.signals?.[i]?.is_meaningful ?? false,
    category: parsed.signals?.[i]?.category ?? 'other',
  }))
}

// ── Layer 2: Extract Observations ─────────────────────────────────────────

export async function extractObservations(
  signals: JudgedSignal[],
  competitors: Competitor[]
): Promise<StructuredObservation[]> {
  if (signals.length === 0) return []

  const meaningful = signals.filter(s => s.is_meaningful)
  if (meaningful.length === 0) return []

  const prompt = `You are a competitive intelligence analyst. Extract factual observations from these signals.

${meaningful.map(s =>
  `Company: ${s.competitor_name} | Category: ${s.category}
Content: ${s.raw_content.slice(0, 800)}`
).join('\n\n---\n\n')}

Respond with JSON: {"observations": [{"competitor_name": string, "what_changed": string, "evidence": string, "category": string, "severity": "high"|"medium"|"low"}]}
- what_changed: factual 1-2 sentence description, no interpretation
- evidence: direct quote from content
- severity: high=major strategic shift, medium=notable change, low=minor update`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  })

  let parsed: { observations: Array<{ competitor_name: string; what_changed: string; evidence: string; category: string; severity: 'high' | 'medium' | 'low' }> }
  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    return []
  }

  return (parsed.observations ?? []).map(obs => {
    const competitor = competitors.find(c => c.name === obs.competitor_name)
    return {
      competitor_id: competitor?.id ?? '',
      competitor_name: obs.competitor_name,
      what_changed: obs.what_changed,
      evidence: obs.evidence,
      category: obs.category,
      severity: obs.severity,
    }
  }).filter(o => o.competitor_id !== '')
}

// ── Layer 3: Strategic Interpretation ─────────────────────────────────────

export async function generateBriefing(
  observations: StructuredObservation[],
  competitors: Competitor[]
): Promise<BriefingResult> {
  if (observations.length === 0) {
    return {
      executive_summary: 'No significant competitive signals detected this period.',
      items: [],
    }
  }

  const prompt = `You are a senior competitive intelligence analyst. Generate a strategic briefing.

Observations:
${observations.map(o =>
  `${o.competitor_name} [${o.category}, ${o.severity}]: ${o.what_changed}
Evidence: ${o.evidence}`
).join('\n\n')}

Respond with JSON: {"executive_summary": string, "items": [{"competitor_name": string, "observation": string, "interpretation": string, "category": string, "severity": "high"|"medium"|"low"}]}

- executive_summary: 2-3 sentences, cross-competitor synthesis with strategic implications
- observation: factual (what changed, from the data above)
- interpretation: bold strategic inference — WHY this likely happened, what it signals, what your company should do. Go beyond description: "This likely means X, possibly because Y, which suggests Z."
- Include ALL competitors from the observations`

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  let parsed: { executive_summary: string; items: Array<{ competitor_name: string; observation: string; interpretation: string; category: string; severity: 'high' | 'medium' | 'low' }> }
  try {
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch {
    return {
      executive_summary: 'Failed to generate briefing summary.',
      items: [],
    }
  }

  return {
    executive_summary: parsed.executive_summary ?? '',
    items: (parsed.items ?? []).map(item => {
      const competitor = competitors.find(c => c.name === item.competitor_name)
      return {
        competitor_name: item.competitor_name,
        competitor_id: competitor?.id ?? '',
        observation: item.observation,
        interpretation: item.interpretation,
        category: item.category,
        severity: item.severity,
      }
    }),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/__tests__/synthesizer.test.ts
```

Expected: PASS — all tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/synthesizer.ts lib/__tests__/synthesizer.test.ts
git commit -m "feat: add 3-layer Groq synthesis pipeline with tests"
```

---

## Task 8: Analyze Route Handler (SSE Streaming)

**Files:**
- Create: `app/api/analyze/route.ts`

**Interfaces:**
- Consumes: `scrapeUrl` from `@/lib/scraper`; `fetchNews` from `@/lib/news`; `judgeSignals`, `extractObservations`, `generateBriefing` from `@/lib/synthesizer`; `createServerClient` from `@/lib/supabase/server`
- Produces: `POST /api/analyze` → SSE stream with events: `progress` `{ message: string }`, `complete` `{ briefing_id: string }`, `error` `{ message: string }`

- [ ] **Step 1: Create the route handler**

Create `app/api/analyze/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { scrapeUrl } from '@/lib/scraper'
import { fetchNews } from '@/lib/news'
import { judgeSignals, extractObservations, generateBriefing, type RawSignal } from '@/lib/synthesizer'
import type { Competitor } from '@/lib/supabase/types'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: 'progress' | 'complete' | 'error', data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        // Get workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .single()
        if (!workspace) { send('error', { message: 'No workspace found' }); controller.close(); return }

        // Get competitors
        const { data: competitors } = await supabase
          .from('competitors')
          .select('*')
          .eq('workspace_id', workspace.id)
        if (!competitors?.length) { send('error', { message: 'Add at least one competitor first' }); controller.close(); return }

        // Create briefing record
        const { data: briefing } = await supabase
          .from('briefings')
          .insert({ workspace_id: workspace.id, status: 'generating' })
          .select()
          .single()
        if (!briefing) { send('error', { message: 'Failed to create briefing' }); controller.close(); return }

        // Scrape competitor websites
        send('progress', { message: 'Fetching competitor websites...' })
        const signals: RawSignal[] = []
        for (const competitor of competitors as Competitor[]) {
          try {
            const content = await scrapeUrl(competitor.website_url)
            signals.push({
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              source_type: 'website',
              raw_content: content.slice(0, 3000),
              url: competitor.website_url,
            })
          } catch {
            // Skip failed scrapes — don't abort the whole run
          }
        }

        // Fetch news
        send('progress', { message: 'Fetching news coverage...' })
        for (const competitor of competitors as Competitor[]) {
          try {
            const newsItems = await fetchNews(competitor.name)
            for (const item of newsItems) {
              signals.push({
                competitor_id: competitor.id,
                competitor_name: competitor.name,
                source_type: 'news',
                raw_content: `${item.title}\n${item.description}`,
                url: item.link,
              })
            }
          } catch {
            // Skip failed news fetches
          }
        }

        // Judge signals
        send('progress', { message: `Judging signal relevance (${signals.length} signals found)...` })
        const judged = await judgeSignals(signals)
        const meaningfulCount = judged.filter(s => s.is_meaningful).length
        send('progress', { message: `${meaningfulCount} meaningful signals identified` })

        // Save signals to DB
        if (signals.length > 0) {
          await supabase.from('signals').insert(
            signals.map(s => ({
              competitor_id: s.competitor_id,
              source_type: s.source_type,
              raw_content: s.raw_content,
              url: s.url,
              is_meaningful: judged.find(j => j.url === s.url && j.competitor_id === s.competitor_id)?.is_meaningful ?? false,
            }))
          )
        }

        // Extract observations
        send('progress', { message: 'Extracting structured observations...' })
        const observations = await extractObservations(judged, competitors as Competitor[])

        // Generate briefing
        send('progress', { message: 'Generating strategic briefing...' })
        const result = await generateBriefing(observations, competitors as Competitor[])

        // Save briefing to DB
        await supabase
          .from('briefings')
          .update({ status: 'complete', executive_summary: result.executive_summary })
          .eq('id', briefing.id)

        if (result.items.length > 0) {
          await supabase.from('briefing_items').insert(
            result.items
              .filter(item => item.competitor_id)
              .map(item => ({
                briefing_id: briefing.id,
                competitor_id: item.competitor_id,
                category: item.category,
                observation: item.observation,
                interpretation: item.interpretation,
                severity: item.severity,
                source_urls: [],
              }))
          )
        }

        send('complete', { briefing_id: briefing.id })
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'Unknown error' })
        controller.close()
        return
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Smoke test via curl**

```bash
# Must be run while logged in via browser. Get the session cookie first, or test via the UI in Task 9.
npm run dev
```

Leave for now — full test via the GenerateButton UI in Task 9.

- [ ] **Step 3: Commit**

```bash
git add app/api/analyze/
git commit -m "feat: add SSE analyze route handler orchestrating scrape + synthesis"
```

---

## Task 9: Dashboard + Competitor UI + GenerateButton

**Files:**
- Create: `components/AddCompetitorForm.tsx`
- Create: `components/CompetitorList.tsx`
- Create: `components/GenerateButton.tsx`
- Create: `app/(app)/dashboard/page.tsx`
- Create: `app/(app)/competitors/page.tsx`

**Interfaces:**
- Consumes: `GET /api/competitors`, `POST /api/competitors`, `DELETE /api/competitors/[id]`, `POST /api/analyze`
- Produces: working dashboard page with competitor list and generate button; progress stream visible during generation

- [ ] **Step 1: Create AddCompetitorForm**

Create `components/AddCompetitorForm.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AddCompetitorForm() {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website_url: url, description }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to add competitor')
      setLoading(false)
      return
    }
    setName(''); setUrl(''); setDescription('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          placeholder="Company name" value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          placeholder="https://competitor.com/pricing" value={url}
          onChange={e => setUrl(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          required type="url"
        />
      </div>
      <input
        placeholder="Brief description (optional)" value={description}
        onChange={e => setDescription(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add Competitor'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create CompetitorList**

Create `components/CompetitorList.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Competitor } from '@/lib/supabase/types'

export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }

  if (competitors.length === 0) {
    return <p className="text-gray-500 text-sm">No competitors added yet.</p>
  }

  return (
    <ul className="space-y-2">
      {competitors.map(c => (
        <li key={c.id} className="flex items-center justify-between bg-white border rounded-lg px-4 py-3">
          <div>
            <p className="font-medium text-sm">{c.name}</p>
            <a href={c.website_url} target="_blank" rel="noreferrer"
              className="text-xs text-blue-500 hover:underline truncate max-w-xs block">
              {c.website_url}
            </a>
            {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
          </div>
          <button
            onClick={() => handleDelete(c.id)}
            disabled={deleting === c.id}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 ml-4"
          >
            {deleting === c.id ? 'Removing...' : 'Remove'}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Create GenerateButton with SSE progress**

Create `components/GenerateButton.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProgressStep {
  message: string
}

export function GenerateButton() {
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [error, setError] = useState('')
  const router = useRouter()

  async function generate() {
    setRunning(true)
    setSteps([])
    setError('')

    const response = await fetch('/api/analyze', { method: 'POST' })
    if (!response.ok || !response.body) {
      setError('Failed to start analysis')
      setRunning(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let eventType = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'progress' && data.message) {
              setSteps(prev => [...prev, { message: data.message }])
            } else if (eventType === 'complete' && data.briefing_id) {
              setRunning(false)
              router.push(`/briefings/${data.briefing_id}`)
              return
            } else if (eventType === 'error') {
              setError(data.message ?? 'Analysis failed')
              setRunning(false)
              return
            }
          } catch {}
          eventType = ''
        }
      }
    }
    setRunning(false)
  }

  return (
    <div className="space-y-4">
      <button
        onClick={generate}
        disabled={running}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? 'Analyzing...' : 'Generate Briefing'}
      </button>

      {steps.length > 0 && (
        <ul className="space-y-1 text-sm text-gray-600">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              {step.message}
            </li>
          ))}
          {running && (
            <li className="flex items-center gap-2 text-blue-500">
              <span className="animate-pulse">⟳</span>
              Working...
            </li>
          )}
        </ul>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create competitors page**

Create `app/(app)/competitors/page.tsx`:

```typescript
import { createServerClient } from '@/lib/supabase/server'
import { AddCompetitorForm } from '@/components/AddCompetitorForm'
import { CompetitorList } from '@/components/CompetitorList'
import type { Competitor } from '@/lib/supabase/types'
import Link from 'next/link'

export default async function CompetitorsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  const competitors: Competitor[] = workspace
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id).order('created_at')).data ?? []
    : []

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Competitors</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      </div>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Add Competitor</h2>
        <AddCompetitorForm />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
          Tracking {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
        </h2>
        <CompetitorList competitors={competitors} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Create dashboard page**

Create `app/(app)/dashboard/page.tsx`:

```typescript
import { createServerClient } from '@/lib/supabase/server'
import { GenerateButton } from '@/components/GenerateButton'
import Link from 'next/link'
import type { Competitor, Briefing } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auto-create workspace if first login
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', user!.id)
    .single()

  if (!workspace) {
    const { data } = await supabase
      .from('workspaces')
      .insert({ name: user!.user_metadata?.company_name ?? 'My Workspace', owner_id: user!.id })
      .select('id, name')
      .single()
    workspace = data
  }

  const competitors: Competitor[] = workspace
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id)).data ?? []
    : []

  const latestBriefing: Briefing | null = workspace
    ? ((await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .eq('status', 'complete').order('generated_at', { ascending: false }).limit(1)).data?.[0] ?? null)
    : null

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Intelligence Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{workspace?.name}</p>
        </div>
        <Link href="/competitors" className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
          Manage Competitors
        </Link>
      </div>

      <section className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Generate Competitive Briefing</h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitors {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} across web and news.
          </p>
        </div>
        {competitors.length === 0 ? (
          <p className="text-sm text-orange-500">
            Add competitors first. <Link href="/competitors" className="underline">Add now →</Link>
          </p>
        ) : (
          <GenerateButton />
        )}
      </section>

      {latestBriefing && (
        <section className="bg-white border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Latest Briefing</h2>
            <Link href={`/briefings/${latestBriefing.id}`} className="text-sm text-blue-600 hover:underline">
              View full →
            </Link>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            {new Date(latestBriefing.generated_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{latestBriefing.executive_summary}</p>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-gray-500 uppercase">Competitors Being Tracked</h2>
        </div>
        {competitors.length === 0 ? (
          <p className="text-sm text-gray-400">No competitors yet.</p>
        ) : (
          <ul className="space-y-2">
            {competitors.map(c => (
              <li key={c.id} className="flex items-center gap-3 bg-white border rounded-lg px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {c.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{c.website_url}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 6: Test the full generate flow**

```bash
npm run dev
```

1. Sign in → land on dashboard
2. Click "Manage Competitors" → add Notion at `https://notion.so/pricing`
3. Return to dashboard → click "Generate Briefing"
4. Verify progress steps appear one by one
5. Verify redirect to `/briefings/[id]` after completion (page 404s until Task 10)

- [ ] **Step 7: Commit**

```bash
git add components/ app/\(app\)/dashboard app/\(app\)/competitors
git commit -m "feat: add dashboard, competitors page, and streaming generate button"
```

---

## Task 10: Briefings API + Detail Page

**Files:**
- Create: `app/api/briefings/route.ts`
- Create: `app/api/briefings/[id]/route.ts`
- Create: `components/BriefingItemCard.tsx`
- Create: `app/(app)/briefings/page.tsx`
- Create: `app/(app)/briefings/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/briefings/[id]` → `{ briefing: Briefing, items: BriefingItem[], competitors: Competitor[] }`
- Produces: briefing detail page showing executive summary + item cards

- [ ] **Step 1: Create briefings list route**

Create `app/api/briefings/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ briefings: [] })

  const { data: briefings } = await supabase
    .from('briefings')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('generated_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ briefings: briefings ?? [] })
}
```

- [ ] **Step 2: Create briefing detail route**

Create `app/api/briefings/[id]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: briefing } = await supabase
    .from('briefings')
    .select('*')
    .eq('id', id)
    .single()
  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('briefing_items')
    .select('*')
    .eq('briefing_id', id)
    .order('severity', { ascending: true })

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  const { data: competitors } = workspace
    ? await supabase.from('competitors').select('*').eq('workspace_id', workspace.id)
    : { data: [] }

  return NextResponse.json({ briefing, items: items ?? [], competitors: competitors ?? [] })
}
```

- [ ] **Step 3: Create BriefingItemCard component**

Create `components/BriefingItemCard.tsx`:

```typescript
import type { BriefingItem, Competitor } from '@/lib/supabase/types'

const severityStyles = {
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  low: 'bg-gray-50 border-gray-200 text-gray-600',
}

const categoryEmoji: Record<string, string> = {
  pricing: '💰',
  product: '🚀',
  hiring: '👥',
  news: '📰',
  positioning: '🎯',
  other: '📌',
}

export function BriefingItemCard({
  item,
  competitors,
}: {
  item: BriefingItem
  competitors: Competitor[]
}) {
  const competitor = competitors.find(c => c.id === item.competitor_id)
  const emoji = categoryEmoji[item.category] ?? '📌'

  return (
    <div className="bg-white border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="font-semibold text-sm">{competitor?.name ?? 'Unknown'}</span>
          <span className="text-xs text-gray-400 capitalize">{item.category}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${severityStyles[item.severity]}`}>
          {item.severity}
        </span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">What changed</p>
          <p className="text-sm text-gray-700 leading-relaxed">{item.observation}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-400 uppercase mb-1">Strategic interpretation</p>
          <p className="text-sm text-blue-800 leading-relaxed">{item.interpretation}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create briefings list page**

Create `app/(app)/briefings/page.tsx`:

```typescript
import { createServerClient } from '@/lib/supabase/server'
import type { Briefing } from '@/lib/supabase/types'
import Link from 'next/link'

export default async function BriefingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  const briefings: Briefing[] = workspace
    ? (await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .order('generated_at', { ascending: false })).data ?? []
    : []

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Briefings</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      </div>
      {briefings.length === 0 ? (
        <p className="text-gray-500 text-sm">No briefings yet. Generate one from the dashboard.</p>
      ) : (
        <ul className="space-y-3">
          {briefings.map(b => (
            <li key={b.id}>
              <Link href={`/briefings/${b.id}`}
                className="block bg-white border rounded-xl p-5 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    {new Date(b.generated_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === 'complete' ? 'bg-green-100 text-green-700' :
                    b.status === 'generating' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{b.status}</span>
                </div>
                {b.executive_summary && (
                  <p className="text-sm text-gray-600 line-clamp-2">{b.executive_summary}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create briefing detail page**

Create `app/(app)/briefings/[id]/page.tsx`:

```typescript
import { createServerClient } from '@/lib/supabase/server'
import { BriefingItemCard } from '@/components/BriefingItemCard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { BriefingItem, Competitor } from '@/lib/supabase/types'

export default async function BriefingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: briefing } = await supabase
    .from('briefings')
    .select('*')
    .eq('id', id)
    .single()
  if (!briefing) notFound()

  const { data: items } = await supabase
    .from('briefing_items')
    .select('*')
    .eq('briefing_id', id)
  
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  const { data: competitors } = workspace
    ? await supabase.from('competitors').select('*').eq('workspace_id', workspace.id)
    : { data: [] }

  const sortedItems = (items ?? []).sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity as 'high' | 'medium' | 'low'] - order[b.severity as 'high' | 'medium' | 'low']
  })

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/briefings" className="text-sm text-blue-600 hover:underline">← All Briefings</Link>
        <Link href={`/api/briefings/${id}/email`} prefetch={false}
          className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
          Email this briefing
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Competitive Briefing</h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date(briefing.generated_at).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </p>
      </div>

      {briefing.executive_summary && (
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
          <h2 className="text-xs font-semibold text-blue-400 uppercase mb-2">Executive Summary</h2>
          <p className="text-gray-800 leading-relaxed">{briefing.executive_summary}</p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">
          {sortedItems.length} Finding{sortedItems.length !== 1 ? 's' : ''}
        </h2>
        {sortedItems.length === 0 ? (
          <p className="text-sm text-gray-400">No significant signals detected this period.</p>
        ) : (
          sortedItems.map(item => (
            <BriefingItemCard
              key={item.id}
              item={item as BriefingItem}
              competitors={(competitors ?? []) as Competitor[]}
            />
          ))
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 6: End-to-end test**

```bash
npm run dev
```

1. Go to dashboard → add 2 real competitors (e.g. `Notion` at `https://notion.so/pricing`, `Linear` at `https://linear.app/pricing`)
2. Click "Generate Briefing"
3. Watch all 5 progress steps appear
4. Confirm redirect to `/briefings/[id]` showing executive summary and item cards
5. Confirm severity badges and "Strategic interpretation" sections are visible

- [ ] **Step 7: Commit**

```bash
git add app/api/briefings/ app/\(app\)/briefings/ components/BriefingItemCard.tsx
git commit -m "feat: add briefings API routes and detail/list pages"
```

---

## Task 11: Email Briefing (Resend)

**Files:**
- Create: `lib/email.ts`
- Create: `app/api/briefings/[id]/email/route.ts`

**Interfaces:**
- Consumes: `GET /api/briefings/[id]` data; `RESEND_API_KEY` env var
- Produces: `GET /api/briefings/[id]/email` → sends email to user's address, returns `{ success: true }`

- [ ] **Step 1: Create email utility**

Create `lib/email.ts`:

```typescript
import { Resend } from 'resend'
import type { BriefingItem, Competitor, Briefing } from './supabase/types'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendBriefingEmail({
  to,
  briefing,
  items,
  competitors,
}: {
  to: string
  briefing: Briefing
  items: BriefingItem[]
  competitors: Competitor[]
}) {
  const sortedItems = [...items].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })

  const itemsHtml = sortedItems.map(item => {
    const competitor = competitors.find(c => c.id === item.competitor_id)
    const severityColor = { high: '#dc2626', medium: '#d97706', low: '#6b7280' }[item.severity]
    return `
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <strong style="font-size:14px;">${competitor?.name ?? 'Unknown'}</strong>
          <span style="font-size:12px;color:${severityColor};text-transform:capitalize;">${item.severity} · ${item.category}</span>
        </div>
        <p style="font-size:14px;color:#374151;margin:0 0 8px;">${item.observation}</p>
        <div style="background:#eff6ff;border-radius:6px;padding:12px;">
          <p style="font-size:12px;color:#3b82f6;font-weight:600;text-transform:uppercase;margin:0 0 4px;">Strategic interpretation</p>
          <p style="font-size:14px;color:#1e40af;margin:0;">${item.interpretation}</p>
        </div>
      </div>
    `
  }).join('')

  const date = new Date(briefing.generated_at).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })

  await resend.emails.send({
    from: 'Competitive Intelligence <onboarding@resend.dev>',
    to,
    subject: `Competitive Briefing — ${date}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="font-size:20px;font-weight:700;margin-bottom:4px;">Competitive Briefing</h1>
        <p style="font-size:14px;color:#6b7280;margin-bottom:24px;">${date}</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:24px;">
          <p style="font-size:12px;color:#3b82f6;font-weight:600;text-transform:uppercase;margin:0 0 4px;">Executive Summary</p>
          <p style="font-size:15px;color:#1e3a8a;margin:0;">${briefing.executive_summary ?? ''}</p>
        </div>
        <h2 style="font-size:14px;font-weight:600;color:#6b7280;text-transform:uppercase;margin-bottom:12px;">${sortedItems.length} Findings</h2>
        ${itemsHtml}
      </div>
    `,
  })
}
```

- [ ] **Step 2: Create email route**

Create `app/api/briefings/[id]/email/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendBriefingEmail } from '@/lib/email'
import type { BriefingItem, Competitor, Briefing } from '@/lib/supabase/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: briefing } = await supabase
    .from('briefings').select('*').eq('id', id).single()
  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('briefing_items').select('*').eq('briefing_id', id)

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('owner_id', user.id).single()

  const { data: competitors } = workspace
    ? await supabase.from('competitors').select('*').eq('workspace_id', workspace.id)
    : { data: [] }

  await sendBriefingEmail({
    to: user.email,
    briefing: briefing as Briefing,
    items: (items ?? []) as BriefingItem[],
    competitors: (competitors ?? []) as Competitor[],
  })

  return NextResponse.redirect(
    new URL(`/briefings/${id}?emailed=true`, _request.url)
  )
}
```

- [ ] **Step 3: Update briefing detail page to show email confirmation**

In `app/(app)/briefings/[id]/page.tsx`, update the function signature to accept `searchParams` and show a toast:

```typescript
// Add searchParams to the function signature:
export default async function BriefingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ emailed?: string }>
}) {
  const { id } = await params
  const { emailed } = await searchParams
  // ... rest of existing code ...

  // Add after the page title block:
  // {emailed && (
  //   <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
  //     ✓ Briefing emailed to your inbox
  //   </div>
  // )}
```

Add the green banner between the title block and executive summary section:

```typescript
      {emailed && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          Briefing emailed to your inbox
        </div>
      )}
```

- [ ] **Step 4: Test email**

```bash
npm run dev
```

1. Open a briefing detail page
2. Click "Email this briefing"
3. Expect redirect back to briefing with green "Briefing emailed to your inbox" banner
4. Check your inbox for the email from `onboarding@resend.dev`

**Note:** Resend sandbox mode sends to your own address only. In the Resend dashboard, confirm the send succeeded under Emails tab.

- [ ] **Step 5: Commit**

```bash
git add lib/email.ts app/api/briefings/
git commit -m "feat: add email briefing via Resend sandbox"
```

---

## Task 12: Demo Seed Data + Final Polish

**Files:**
- Modify: `app/(app)/dashboard/page.tsx` — seed demo competitors on first login
- Modify: `app/layout.tsx` — nav bar

**Interfaces:**
- Produces: first-time users land on a populated dashboard with 3 real competitors pre-seeded

- [ ] **Step 1: Add nav bar to root layout**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Competitive Intelligence',
  description: 'AI-powered competitive briefings',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
```

Create `app/(app)/layout.tsx` nav (replace the existing auth-only layout):

```typescript
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-blue-700">IntelAgent</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/competitors" className="text-gray-600 hover:text-gray-900">Competitors</Link>
          <Link href="/briefings" className="text-gray-600 hover:text-gray-900">Briefings</Link>
          <span className="text-gray-400 text-xs">{user.email}</span>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Add demo competitor seeding to dashboard**

In `app/(app)/dashboard/page.tsx`, after the workspace auto-create block, add:

```typescript
  // Seed demo competitors if workspace is new and has none
  if (workspace) {
    const { count } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)

    if (count === 0) {
      await supabase.from('competitors').insert([
        { workspace_id: workspace.id, name: 'Notion', website_url: 'https://notion.so/pricing', description: 'All-in-one workspace' },
        { workspace_id: workspace.id, name: 'Linear', website_url: 'https://linear.app/pricing', description: 'Issue tracking for software teams' },
        { workspace_id: workspace.id, name: 'Asana', website_url: 'https://asana.com/pricing', description: 'Project management platform' },
      ])
    }
  }
```

- [ ] **Step 3: Add Vercel keepalive cron**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/keepalive",
      "schedule": "0 12 * * *"
    }
  ]
}
```

Create `app/api/keepalive/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  await supabase.from('workspaces').select('id').limit(1)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: all 9 tests passing (scraper ×2, news ×4, synthesizer ×3)

- [ ] **Step 5: Full demo run-through**

```bash
npm run dev
```

Walk through the complete demo flow:
1. Go to `http://localhost:3000` → redirect to `/login`
2. Sign up with a new account → redirect to `/dashboard`
3. Dashboard shows 3 pre-seeded competitors (Notion, Linear, Asana)
4. Click "Generate Briefing" → watch 5 progress steps stream in
5. Redirect to briefing detail → executive summary + findings with interpretation
6. Click "Email this briefing" → redirect back with confirmation banner

- [ ] **Step 6: Deploy to Vercel**

```bash
npx vercel --prod
```

Set environment variables in Vercel dashboard (Settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `RESEND_API_KEY`

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: add demo seed data, nav, keepalive cron, deploy to Vercel"
```

---

## Test Coverage Summary

| File | Tests | What's covered |
|---|---|---|
| `lib/__tests__/scraper.test.ts` | 2 | Jina URL construction, error handling |
| `lib/__tests__/news.test.ts` | 4 | RSS URL, 7-day filter, shape mapping, error |
| `lib/__tests__/synthesizer.test.ts` | 7 | Empty inputs, meaningful/not-meaningful signals, observation extraction, briefing generation |

UI components and API routes are verified through the end-to-end manual test in Task 12 Step 5.
