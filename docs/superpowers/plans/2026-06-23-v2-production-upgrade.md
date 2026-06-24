# Competitive Intelligence Agent — v2 Production Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the v1 MVP into a production-ready competitive intelligence SaaS with professional auth (Google OAuth, forgot password, password toggle, sign out), a polished sidebar UI, automated daily briefings via Vercel Cron, change detection, news deduplication, and live deployment to GitHub + Vercel.

**Architecture:** Eleven sequential tasks — foundation utilities first, then auth routing, auth page redesigns, sidebar layout, page redesigns, intelligence upgrades (change detection + cron), and finally deployment. Each task produces independently testable, committable output.

**Tech Stack:** Next.js 16.2.9 App Router, TypeScript, React 19, Supabase (`@supabase/ssr` v0.12.0), Groq (llama-3.3-70b-versatile), Resend sandbox, Jina AI Reader, Google News RSS, Vercel Hobby, Tailwind CSS.

## Global Constraints

- Next.js 16.2.9 — REQUIRED: read `node_modules/next/dist/docs/` before writing any route or page code; `params` and `searchParams` in pages are `Promise<{...}>` and must be awaited; `middleware.ts` is replaced by `proxy.ts` exporting `proxy` function
- React 19 — no legacy lifecycle methods; `'use client'` required on any component using hooks or browser APIs
- `@supabase/ssr` v0.12.0 — use `createBrowserClient` from `lib/supabase/client.ts`, `createServerClient` from `lib/supabase/server.ts`; never import directly from `@supabase/supabase-js` in pages/components except in `lib/supabase/admin.ts`
- Tailwind CSS only — no inline `style` props; no additional UI libraries
- No new npm packages except where explicitly specified; all free-tier services only
- Design system: primary accent `indigo-600`, background `gray-50`, cards `bg-white rounded-xl border border-gray-200 shadow-sm`, text hierarchy `gray-900` / `gray-700` / `gray-500`
- Test runner: Vitest 4.x — use `vi.hoisted` for any mock factories; run tests with `npm test`
- All API keys live in `.env.local` only — never committed to git

---

### Task 1: Foundation — config, hash utility, schema additions, types

**Files:**
- Create: `lib/config.ts`
- Create: `lib/hash.ts`
- Create: `lib/__tests__/hash.test.ts`
- Modify: `lib/supabase/types.ts`
- Modify: `db/schema.sql`
- Modify: `.env.local` (add two new vars)

**Interfaces:**
- Produces: `siteUrl` from `@/lib/config`; `sha256(text: string): Promise<string>` from `@/lib/hash`; `ProcessedNewsUrl` interface and updated `Signal` interface from `@/lib/supabase/types`

- [ ] **Step 1: Write the failing hash test**

Create `lib/__tests__/hash.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sha256 } from '../hash'

describe('sha256', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const result = await sha256('hello')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('returns the same hash for the same input', async () => {
    const a = await sha256('competitive intelligence')
    const b = await sha256('competitive intelligence')
    expect(a).toBe(b)
  })

  it('returns different hashes for different inputs', async () => {
    const a = await sha256('foo')
    const b = await sha256('bar')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- hash
```
Expected: FAIL with "Cannot find module '../hash'"

- [ ] **Step 3: Create lib/config.ts**

```ts
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
```

- [ ] **Step 4: Create lib/hash.ts**

```ts
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
npm test -- hash
```
Expected: PASS — 3 tests passing

- [ ] **Step 6: Update lib/supabase/types.ts**

Replace the entire file:

```ts
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
  content_hash: string | null
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

export interface ProcessedNewsUrl {
  id: string
  workspace_id: string
  url: string
  processed_at: string
}
```

- [ ] **Step 7: Append schema changes to db/schema.sql**

Add to the bottom of `db/schema.sql`:

```sql
-- v2: change detection
ALTER TABLE signals ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS signals_competitor_hash ON signals(competitor_id, content_hash);

-- v2: news deduplication
CREATE TABLE IF NOT EXISTS processed_news_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, url)
);
ALTER TABLE processed_news_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON processed_news_urls
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
```

- [ ] **Step 8: Add new env vars to .env.local**

Open `.env.local` and add these two lines (keep existing vars):

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=dev-cron-secret-change-in-prod
```

- [ ] **Step 9: Run full test suite — expect all passing**

```bash
npm test
```
Expected: all existing tests (scraper, news, synthesizer) + 3 new hash tests = 15 tests passing

- [ ] **Step 10: Commit**

```bash
git add lib/config.ts lib/hash.ts lib/__tests__/hash.test.ts lib/supabase/types.ts db/schema.sql .env.local
git commit -m "feat: add config, hash utility, schema v2 additions, ProcessedNewsUrl type"
```

---

### Task 2: Auth routing — proxy update, OAuth callback, forgot-password, reset-password

**Files:**
- Modify: `proxy.ts`
- Create: `app/(auth)/auth/callback/route.ts`
- Create: `app/(auth)/forgot-password/page.tsx`
- Create: `app/(auth)/reset-password/page.tsx`

**Interfaces:**
- Consumes: `createServerClient` from `@/lib/supabase/server`; `createClient` from `@/lib/supabase/client`; `siteUrl` from `@/lib/config`
- Produces: `/auth/callback` GET route (exchanges OAuth/magic-link code for session); `/forgot-password` page; `/reset-password` page

- [ ] **Step 1: Update proxy.ts**

Replace the entire file:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  const isAuthPath =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/forgot-password') ||
    request.nextUrl.pathname.startsWith('/reset-password')

  if (!user && !isAuthPath && request.nextUrl.pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  // exclude /api, /auth (callback route), and Next.js internals
  matcher: ['/((?!api|auth|_next/static|_next/image|favicon\\.ico).*)'],
}
```

- [ ] **Step 2: Create app/(auth)/auth/callback/route.ts**

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

- [ ] **Step 3: Create app/(auth)/forgot-password/page.tsx**

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { siteUrl } from '@/lib/config'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-indigo-600">IntelAgent</span>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">Reset your password</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your email and we'll send a reset link.</p>
        </div>
        {sent ? (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm text-center">
            Check your email for a password reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@company.com" required
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-gray-500">
          <Link href="/login" className="text-indigo-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create app/(auth)/reset-password/page.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  )
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-indigo-600">IntelAgent</span>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">Set new password</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Min 6 characters" required minLength={6}
              />
              <button
                type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}
          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors"
          >
            {loading ? 'Saving...' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify dev server starts without errors**

```bash
npm run dev
```
Expected: server starts, no TypeScript errors in terminal. Visit `http://localhost:3000/forgot-password` — should show the reset form.

- [ ] **Step 6: Commit**

```bash
git add proxy.ts app/\(auth\)/auth/callback/route.ts app/\(auth\)/forgot-password/page.tsx app/\(auth\)/reset-password/page.tsx
git commit -m "feat: add OAuth callback route, forgot/reset password pages, update proxy matcher"
```

---

### Task 3: Auth pages redesign — login and signup with Google OAuth + password toggle

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`; `siteUrl` from `@/lib/config`
- Produces: redesigned login and signup pages with Google OAuth button, password visibility toggle, "Forgot password?" link

- [ ] **Step 1: Replace app/(auth)/login/page.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { siteUrl } from '@/lib/config'
import Link from 'next/link'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-indigo-600">IntelAgent</span>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@company.com" required autoComplete="email"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-xs text-indigo-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••" required autoComplete="current-password"
              />
              <button
                type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          No account?{' '}
          <Link href="/signup" className="text-indigo-600 hover:underline font-medium">Create one</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace app/(auth)/signup/page.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { siteUrl } from '@/lib/config'
import Link from 'next/link'

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  )
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      options: { data: { company_name: name } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-indigo-600">IntelAgent</span>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">Create your account</h1>
          <p className="text-sm text-gray-500 mt-1">Start monitoring competitors today</p>
        </div>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Acme Corp" required autoComplete="organization"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@company.com" required autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Min 6 characters" required minLength={6} autoComplete="new-password"
              />
              <button
                type="button" onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Visit `http://localhost:3000/login` — should show Google OAuth button, email/password fields, "Forgot password?" link, password eye toggle. Eye icon should toggle password visibility. No TypeScript errors in terminal.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 15 tests passing (no regressions)

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/login/page.tsx app/\(auth\)/signup/page.tsx
git commit -m "feat: redesign auth pages with Google OAuth, password toggle, forgot password link"
```

---

### Task 4: App layout — sidebar with active nav, user menu, sign out

**Files:**
- Create: `components/Sidebar.tsx`
- Modify: `app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `createServerClient` from `@/lib/supabase/server`; `createClient` from `@/lib/supabase/client`
- Produces: `Sidebar` client component accepting `{ email: string }`; new two-zone layout with 240px fixed sidebar + `ml-60` main content area

- [ ] **Step 1: Create components/Sidebar.tsx**

```tsx
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    href: '/competitors',
    label: 'Competitors',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: '/briefings',
    label: 'Briefings',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const initials = email.slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 flex flex-col z-10">
      <div className="px-6 py-5 border-b border-gray-100">
        <span className="text-xl font-bold text-indigo-600">IntelAgent</span>
        <p className="text-xs text-gray-400 mt-0.5">Competitive Intelligence</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_LINKS.map(link => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={active ? 'text-indigo-600' : 'text-gray-400'}>{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <span className="text-xs text-gray-600 truncate min-w-0">{email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs text-gray-400 hover:text-red-600 transition-colors px-1 py-1"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace app/(app)/layout.tsx**

```tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar email={user.email ?? ''} />
      <main className="ml-60 min-h-screen">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Log in at `http://localhost:3000/login`, land on dashboard. Should see: left sidebar with IntelAgent logo, Dashboard/Competitors/Briefings links, user email + "Sign out" at bottom. Active link highlighted in indigo. Main content shifted right of sidebar. Sign out button should log out and redirect to `/login`.

- [ ] **Step 4: Commit**

```bash
git add components/Sidebar.tsx app/\(app\)/layout.tsx
git commit -m "feat: replace top-nav with sidebar layout, add sign out"
```

---

### Task 5: Dashboard redesign — remove seed data, add empty state, new design

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `createServerClient`; `GenerateButton` from `@/components/GenerateButton`; `Briefing`, `Competitor` types
- Produces: dashboard page with no auto-seeding, proper empty state, updated visual design

- [ ] **Step 1: Replace app/(app)/dashboard/page.tsx**

```tsx
import { createServerClient } from '@/lib/supabase/server'
import { GenerateButton } from '@/components/GenerateButton'
import Link from 'next/link'
import type { Competitor, Briefing } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

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
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id).order('created_at')).data ?? []
    : []

  const latestBriefing: Briefing | null = workspace
    ? ((await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .eq('status', 'complete').order('generated_at', { ascending: false }).limit(1)).data?.[0] ?? null)
    : null

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{workspace?.name}</p>
      </div>

      {competitors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No competitors tracked yet</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
            Add your first competitor to start generating AI-powered intelligence briefings.
          </p>
          <Link
            href="/competitors"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Add Competitor
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Generate Briefing</h2>
              <p className="text-sm text-gray-500 mb-4">
                Monitors {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} across web and news, then synthesizes strategic insights.
              </p>
              <GenerateButton />
            </div>

            {latestBriefing && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Latest Briefing</h2>
                  <Link href={`/briefings/${latestBriefing.id}`} className="text-sm text-indigo-600 hover:underline">
                    View full →
                  </Link>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {new Date(latestBriefing.generated_at).toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{latestBriefing.executive_summary}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tracked</h2>
                <Link href="/competitors" className="text-xs text-indigo-600 hover:underline">Manage</Link>
              </div>
              <ul className="space-y-3">
                {competitors.map(c => (
                  <li key={c.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.website_url}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Visit `/dashboard`. If no competitors: should show empty state with "Add Competitor" CTA — no Notion/Linear/Asana rows. If competitors exist: should show Generate Briefing section + competitor list in sidebar panel. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/dashboard/page.tsx
git commit -m "feat: redesign dashboard, remove auto-seed, add empty state"
```

---

### Task 6: Competitor UI redesign — favicon fetching, AddCompetitorForm, CompetitorList, page

**Files:**
- Modify: `components/AddCompetitorForm.tsx`
- Modify: `components/CompetitorList.tsx`
- Modify: `app/(app)/competitors/page.tsx`

**Interfaces:**
- Consumes: `Competitor` type from `@/lib/supabase/types`
- Produces: redesigned competitor management UI with favicon images, indigo design system

- [ ] **Step 1: Replace components/AddCompetitorForm.tsx**

```tsx
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
    setName('')
    setUrl('')
    setDescription('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-gray-900">Add Competitor</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Company name</label>
          <input
            placeholder="e.g. Notion" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">URL to monitor</label>
          <input
            placeholder="https://competitor.com/pricing" value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            required type="url"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-gray-400">(optional)</span></label>
        <input
          placeholder="Brief description of what they do" value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}
      <button
        type="submit" disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Adding...' : 'Add Competitor'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Replace components/CompetitorList.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Competitor } from '@/lib/supabase/types'

function CompetitorFavicon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  let domain = ''
  try { domain = new URL(url).hostname } catch { /* invalid url */ }

  if (failed || !domain) {
    return (
      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
        {name[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={36}
      height={36}
      className="w-9 h-9 rounded-lg object-contain flex-shrink-0 bg-gray-50 border border-gray-100 p-1"
      onError={() => setFailed(true)}
    />
  )
}

export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(id: string) {
    setDeleting(id)
    setDeleteError(null)
    const res = await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setDeleteError('Failed to remove competitor')
    }
    setDeleting(null)
    router.refresh()
  }

  if (competitors.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-sm text-gray-500">No competitors added yet. Use the form above to add one.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {deleteError && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-3 text-sm">{deleteError}</div>
      )}
      <ul className="divide-y divide-gray-100">
        {competitors.map(c => (
          <li key={c.id} className="flex items-center gap-4 px-5 py-4">
            <CompetitorFavicon url={c.website_url} name={c.name} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900">{c.name}</p>
              <a
                href={c.website_url} target="_blank" rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline truncate block max-w-sm"
              >
                {c.website_url}
              </a>
              {c.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{c.description}</p>
              )}
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              disabled={deleting === c.id}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors flex-shrink-0 ml-2"
            >
              {deleting === c.id ? 'Removing...' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Replace app/(app)/competitors/page.tsx**

```tsx
import { createServerClient } from '@/lib/supabase/server'
import { AddCompetitorForm } from '@/components/AddCompetitorForm'
import { CompetitorList } from '@/components/CompetitorList'
import type { Competitor } from '@/lib/supabase/types'

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
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Competitors</h1>
        <p className="text-sm text-gray-500 mt-1">
          {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked
        </p>
      </div>
      <AddCompetitorForm />
      <CompetitorList competitors={competitors} />
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Visit `/competitors`. Should show the add form card at top, then the list. Each competitor should show a favicon (or initial circle fallback). Remove button should work. No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add components/AddCompetitorForm.tsx components/CompetitorList.tsx app/\(app\)/competitors/page.tsx
git commit -m "feat: redesign competitor UI with favicon fetching, error display"
```

---

### Task 7: Briefings UI redesign — BriefingItemCard, list page, detail page

**Files:**
- Modify: `components/BriefingItemCard.tsx`
- Modify: `app/(app)/briefings/page.tsx`
- Modify: `app/(app)/briefings/[id]/page.tsx`

**Interfaces:**
- Consumes: `BriefingItem`, `Competitor`, `Briefing` types
- Produces: redesigned briefings list and detail with severity left-border cards, indigo design system

- [ ] **Step 1: Replace components/BriefingItemCard.tsx**

```tsx
import type { BriefingItem, Competitor } from '@/lib/supabase/types'

const severityLeftBorder: Record<string, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-amber-500',
  low: 'border-l-4 border-l-gray-300',
}

const severityBadge: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
}

const categoryLabel: Record<string, string> = {
  pricing: 'Pricing',
  product: 'Product',
  hiring: 'Hiring',
  news: 'News',
  positioning: 'Positioning',
  other: 'Other',
}

export function BriefingItemCard({
  item,
  competitors,
}: {
  item: BriefingItem
  competitors: Competitor[]
}) {
  const competitor = competitors.find(c => c.id === item.competitor_id)
  const borderClass = severityLeftBorder[item.severity] ?? severityLeftBorder.low
  const badgeClass = severityBadge[item.severity] ?? severityBadge.low

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${borderClass} overflow-hidden`}>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm text-gray-900">{competitor?.name ?? 'Unknown'}</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{categoryLabel[item.category] ?? item.category}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${badgeClass}`}>
            {item.severity}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">What changed</p>
            <p className="text-sm text-gray-700 leading-relaxed">{item.observation}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3.5">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Strategic interpretation</p>
            <p className="text-sm text-indigo-900 leading-relaxed">{item.interpretation}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace app/(app)/briefings/page.tsx**

```tsx
import { createServerClient } from '@/lib/supabase/server'
import type { Briefing } from '@/lib/supabase/types'
import Link from 'next/link'

const statusBadge: Record<string, string> = {
  complete: 'bg-green-50 text-green-700',
  generating: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
}

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
        .order('generated_at', { ascending: false }).limit(20)).data ?? []
    : []

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Briefings</h1>
        <p className="text-sm text-gray-500 mt-1">Your competitive intelligence history</p>
      </div>

      {briefings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No briefings yet</h3>
          <p className="text-sm text-gray-500 mb-5">Generate your first competitive intelligence briefing from the dashboard.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {briefings.map(b => (
            <li key={b.id}>
              <Link
                href={`/briefings/${b.id}`}
                className="block bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(b.generated_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize flex-shrink-0 ${statusBadge[b.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {b.status}
                  </span>
                </div>
                {b.executive_summary && (
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{b.executive_summary}</p>
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

- [ ] **Step 3: Replace app/(app)/briefings/[id]/page.tsx**

```tsx
import { createServerClient } from '@/lib/supabase/server'
import { BriefingItemCard } from '@/components/BriefingItemCard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { BriefingItem, Competitor } from '@/lib/supabase/types'

export default async function BriefingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ emailed?: string }>
}) {
  const { id } = await params
  const { emailed } = await searchParams
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
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-6">
      {emailed === 'true' && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm font-medium">
          Briefing emailed successfully.
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/briefings" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">
            ← All Briefings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Competitive Briefing</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date(briefing.generated_at).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <a
          href={`/api/briefings/${id}/email`}
          className="flex-shrink-0 inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email briefing
        </a>
      </div>

      {briefing.executive_summary && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-2">Executive Summary</p>
          <p className="text-gray-800 leading-relaxed">{briefing.executive_summary}</p>
        </div>
      )}

      <div className="space-y-4">
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {sortedItems.length} Finding{sortedItems.length !== 1 ? 's' : ''}
        </p>
        {sortedItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-sm text-gray-500">No significant signals detected this period.</p>
          </div>
        ) : (
          sortedItems.map(item => (
            <BriefingItemCard
              key={item.id}
              item={item as BriefingItem}
              competitors={(competitors ?? []) as Competitor[]}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Visit `/briefings` — should show empty state or briefing list with status badges. Click a briefing — should show executive summary in indigo gradient card, briefing item cards with colored left borders (red/amber/gray by severity), "Email briefing" button.

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: 15 tests passing

- [ ] **Step 6: Commit**

```bash
git add components/BriefingItemCard.tsx app/\(app\)/briefings/page.tsx app/\(app\)/briefings/\[id\]/page.tsx
git commit -m "feat: redesign briefings UI with severity borders, empty states"
```

---

### Task 8: GenerateButton — animated step sequence

**Files:**
- Modify: `components/GenerateButton.tsx`

**Interfaces:**
- Consumes: SSE events from `POST /api/analyze` (`progress`, `complete`, `error` events)
- Produces: animated 5-step progress UI showing spinner → checkmark transitions

- [ ] **Step 1: Replace components/GenerateButton.tsx**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  'Fetching competitor websites',
  'Fetching news coverage',
  'Analyzing signal relevance',
  'Extracting structured observations',
  'Generating strategic briefing',
]

function stepIndexFromMessage(msg: string): number {
  if (msg.includes('websites')) return 0
  if (msg.includes('news')) return 1
  if (msg.includes('signal') || msg.includes('meaningful')) return 2
  if (msg.includes('observations')) return 3
  if (msg.includes('briefing') || msg.includes('strategic')) return 4
  return -1
}

export function GenerateButton() {
  const [running, setRunning] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const router = useRouter()

  async function generate() {
    setRunning(true)
    setActiveStep(0)
    setCompletedSteps(new Set())
    setError('')

    const response = await fetch('/api/analyze', { method: 'POST' })
    if (!response.ok || !response.body) {
      setError('Failed to start analysis. Please try again.')
      setRunning(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventType = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'progress' && data.message) {
              const idx = stepIndexFromMessage(data.message)
              if (idx >= 0) {
                setCompletedSteps(prev => {
                  const next = new Set(prev)
                  // mark all steps before this one complete
                  for (let i = 0; i < idx; i++) next.add(i)
                  return next
                })
                setActiveStep(idx)
              }
            } else if (eventType === 'complete' && data.briefing_id) {
              setCompletedSteps(new Set([0, 1, 2, 3, 4]))
              setRunning(false)
              router.push(`/briefings/${data.briefing_id}`)
              return
            } else if (eventType === 'error') {
              setError(data.message ?? 'Analysis failed')
              setRunning(false)
              return
            }
          } catch { /* ignore parse errors */ }
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
        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm transition-colors"
      >
        {running ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Briefing
          </>
        )}
      </button>

      {running && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Running analysis</p>
          {STEPS.map((step, idx) => {
            const isComplete = completedSteps.has(idx)
            const isActive = activeStep === idx && !isComplete
            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isComplete ? (
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <svg className="w-4 h-4 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                  )}
                </div>
                <span className={`text-sm ${isComplete ? 'text-gray-500 line-through' : isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                  {step}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Go to dashboard with competitors added. Click "Generate Briefing". Should see the 5 steps animate in sequence: gray circle → indigo spinner (active) → green checkmark (done). On completion, redirect to briefing detail.

- [ ] **Step 3: Commit**

```bash
git add components/GenerateButton.tsx
git commit -m "feat: redesign GenerateButton with animated 5-step progress sequence"
```

---

### Task 9: Intelligence upgrades — change detection, news dedup, high-severity alerts

**Files:**
- Modify: `app/api/analyze/route.ts`
- Modify: `lib/email.ts`

**Interfaces:**
- Consumes: `sha256` from `@/lib/hash`; `sendBriefingEmail` (existing); new `sendHighSeverityAlert`
- Produces: updated analyze route with content hash checks and news URL deduplication; `sendHighSeverityAlert({ to, items, competitors })` in `lib/email.ts`

- [ ] **Step 1: Add sendHighSeverityAlert to lib/email.ts**

Append this function to the bottom of `lib/email.ts`:

```ts
export async function sendHighSeverityAlert({
  to,
  items,
  competitors,
}: {
  to: string
  items: BriefingItem[]
  competitors: Competitor[]
}) {
  const itemsHtml = items.map(item => {
    const competitor = competitors.find(c => c.id === item.competitor_id)
    return `
      <div style="border-left:4px solid #dc2626;padding:12px 16px;margin-bottom:12px;background:#fff5f5;border-radius:0 8px 8px 0;">
        <strong style="font-size:14px;color:#111827;">${competitor?.name ?? 'Unknown'}</strong>
        <span style="font-size:12px;color:#dc2626;margin-left:8px;text-transform:capitalize;">${item.category}</span>
        <p style="font-size:14px;color:#374151;margin:8px 0;">${item.observation}</p>
        <p style="font-size:13px;color:#7c3aed;font-style:italic;">${item.interpretation}</p>
      </div>
    `
  }).join('')

  const competitorNames = [...new Set(items.map(i => competitors.find(c => c.id === i.competitor_id)?.name ?? 'Unknown'))].join(', ')

  await resend.emails.send({
    from: 'IntelAgent Alerts <onboarding@resend.dev>',
    to,
    subject: `🚨 Urgent competitive signal: ${competitorNames}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h1 style="font-size:18px;font-weight:700;color:#dc2626;margin-bottom:4px;">High-Priority Alert</h1>
        <p style="font-size:14px;color:#6b7280;margin-bottom:20px;">${items.length} urgent signal${items.length !== 1 ? 's' : ''} detected</p>
        ${itemsHtml}
        <p style="font-size:12px;color:#9ca3af;margin-top:24px;">View your full briefing in <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/briefings" style="color:#4f46e5;">IntelAgent</a></p>
      </div>
    `,
  })
}
```

- [ ] **Step 2: Replace app/api/analyze/route.ts**

```ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { scrapeUrl } from '@/lib/scraper'
import { fetchNews } from '@/lib/news'
import { judgeSignals, extractObservations, generateBriefing, type RawSignal } from '@/lib/synthesizer'
import { sendBriefingEmail, sendHighSeverityAlert } from '@/lib/email'
import { sha256 } from '@/lib/hash'
import type { Competitor } from '@/lib/supabase/types'

export const maxDuration = 60

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
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .single()
        if (!workspace) { send('error', { message: 'No workspace found' }); controller.close(); return }

        const { data: competitors } = await supabase
          .from('competitors')
          .select('*')
          .eq('workspace_id', workspace.id)
        if (!competitors?.length) { send('error', { message: 'Add at least one competitor first' }); controller.close(); return }

        const { data: briefing } = await supabase
          .from('briefings')
          .insert({ workspace_id: workspace.id, status: 'generating' })
          .select()
          .single()
        if (!briefing) { send('error', { message: 'Failed to create briefing' }); controller.close(); return }

        // ── Scrape websites with change detection ─────────────────────────
        send('progress', { message: 'Fetching competitor websites...' })
        const signals: RawSignal[] = []

        for (const competitor of competitors as Competitor[]) {
          try {
            const content = await scrapeUrl(competitor.website_url)
            const hash = await sha256(content)

            // skip if we already processed this exact content
            const { data: existing } = await supabase
              .from('signals')
              .select('id')
              .eq('competitor_id', competitor.id)
              .eq('content_hash', hash)
              .limit(1)
              .single()

            if (existing) continue // unchanged since last run

            signals.push({
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              source_type: 'website',
              raw_content: content.slice(0, 3000),
              url: competitor.website_url,
            })

            await supabase.from('signals').insert({
              competitor_id: competitor.id,
              source_type: 'website',
              raw_content: content.slice(0, 3000),
              url: competitor.website_url,
              content_hash: hash,
              is_meaningful: null,
            })
          } catch { /* skip failed scrapes */ }
        }

        // ── Fetch news with URL deduplication ────────────────────────────
        send('progress', { message: 'Fetching news coverage...' })

        for (const competitor of competitors as Competitor[]) {
          try {
            const newsItems = await fetchNews(competitor.name)
            const urls = newsItems.map(i => i.link)

            // find which URLs we've already processed for this workspace
            const { data: seen } = await supabase
              .from('processed_news_urls')
              .select('url')
              .eq('workspace_id', workspace.id)
              .in('url', urls)
            const seenUrls = new Set((seen ?? []).map(r => r.url))

            const newItems = newsItems.filter(i => !seenUrls.has(i.link))

            for (const item of newItems) {
              signals.push({
                competitor_id: competitor.id,
                competitor_name: competitor.name,
                source_type: 'news',
                raw_content: `${item.title}\n${item.description}`,
                url: item.link,
              })
            }

            if (newItems.length > 0) {
              await supabase.from('processed_news_urls').upsert(
                newItems.map(i => ({ workspace_id: workspace.id, url: i.link })),
                { onConflict: 'workspace_id,url' }
              )
            }
          } catch { /* skip failed news */ }
        }

        // ── Judge signals ──────────────────────────────────────────────────
        send('progress', { message: `Analyzing signal relevance (${signals.length} signals found)...` })
        const judged = await judgeSignals(signals)
        const meaningfulCount = judged.filter(s => s.is_meaningful).length
        send('progress', { message: `${meaningfulCount} meaningful signals identified` })

        // persist news signals to DB with is_meaningful classification
        const newsJudged = judged.filter(s => s.source_type === 'news')
        if (newsJudged.length > 0) {
          await supabase.from('signals').insert(
            newsJudged.map(j => ({
              competitor_id: j.competitor_id,
              source_type: 'news',
              raw_content: j.raw_content.slice(0, 3000),
              url: j.url,
              is_meaningful: j.is_meaningful,
            }))
          )
        }

        // ── Extract observations ───────────────────────────────────────────
        send('progress', { message: 'Extracting structured observations...' })
        const observations = await extractObservations(judged, competitors as Competitor[])

        // ── Generate briefing ──────────────────────────────────────────────
        send('progress', { message: 'Generating strategic briefing...' })
        const result = await generateBriefing(observations, competitors as Competitor[])

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

        // ── Email alerts ───────────────────────────────────────────────────
        const highItems = result.items.filter(i => i.severity === 'high' && i.competitor_id)
        if (highItems.length > 0) {
          try {
            await sendHighSeverityAlert({
              to: user.email!,
              items: highItems as Parameters<typeof sendHighSeverityAlert>[0]['items'],
              competitors: competitors as Competitor[],
            })
          } catch { /* non-fatal */ }
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

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: 15 tests passing (lib/email.ts has no unit tests; changes are integration-level)

- [ ] **Step 4: Verify in browser**

Generate a briefing. On the second run with the same competitors, scrapes of unchanged pages should be skipped (fewer "signals found"). Check Supabase table `processed_news_urls` — should have rows after first run.

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts lib/email.ts
git commit -m "feat: add change detection via content hash, news dedup, high-severity email alerts"
```

---

### Task 10: Daily cron route — automated briefings for all workspaces

**Files:**
- Create: `lib/supabase/admin.ts`
- Create: `app/api/cron/daily-brief/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `scrapeUrl`, `fetchNews`, `judgeSignals`, `extractObservations`, `generateBriefing`, `sendBriefingEmail`, `sendHighSeverityAlert`, `sha256`; `createAdminClient` (new)
- Produces: GET `/api/cron/daily-brief` — processes all workspaces, generates and emails briefings; service-role Supabase client in `lib/supabase/admin.ts`

- [ ] **Step 1: Create lib/supabase/admin.ts**

```ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 2: Create app/api/cron/daily-brief/route.ts**

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scrapeUrl } from '@/lib/scraper'
import { fetchNews } from '@/lib/news'
import { judgeSignals, extractObservations, generateBriefing, type RawSignal } from '@/lib/synthesizer'
import { sendBriefingEmail, sendHighSeverityAlert } from '@/lib/email'
import { sha256 } from '@/lib/hash'
import type { Competitor, BriefingItem } from '@/lib/supabase/types'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: workspaces } = await supabase.from('workspaces').select('*')
  if (!workspaces?.length) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0

  for (const workspace of workspaces) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(workspace.owner_id)
      if (!user?.email) continue

      const { data: competitors } = await supabase
        .from('competitors')
        .select('*')
        .eq('workspace_id', workspace.id)
      if (!competitors?.length) continue

      const signals: RawSignal[] = []

      // scrape websites with change detection
      for (const competitor of competitors as Competitor[]) {
        try {
          const content = await scrapeUrl(competitor.website_url)
          const hash = await sha256(content)
          const { data: existing } = await supabase
            .from('signals')
            .select('id')
            .eq('competitor_id', competitor.id)
            .eq('content_hash', hash)
            .limit(1)
            .single()
          if (existing) continue
          signals.push({
            competitor_id: competitor.id,
            competitor_name: competitor.name,
            source_type: 'website',
            raw_content: content.slice(0, 3000),
            url: competitor.website_url,
          })
          await supabase.from('signals').insert({
            competitor_id: competitor.id,
            source_type: 'website',
            raw_content: content.slice(0, 3000),
            url: competitor.website_url,
            content_hash: hash,
            is_meaningful: null,
          })
        } catch { /* skip */ }
      }

      // fetch news with deduplication
      for (const competitor of competitors as Competitor[]) {
        try {
          const newsItems = await fetchNews(competitor.name)
          const urls = newsItems.map(i => i.link)
          const { data: seen } = await supabase
            .from('processed_news_urls')
            .select('url')
            .eq('workspace_id', workspace.id)
            .in('url', urls)
          const seenUrls = new Set((seen ?? []).map(r => r.url))
          const newItems = newsItems.filter(i => !seenUrls.has(i.link))
          for (const item of newItems) {
            signals.push({
              competitor_id: competitor.id,
              competitor_name: competitor.name,
              source_type: 'news',
              raw_content: `${item.title}\n${item.description}`,
              url: item.link,
            })
          }
          if (newItems.length > 0) {
            await supabase.from('processed_news_urls').upsert(
              newItems.map(i => ({ workspace_id: workspace.id, url: i.link })),
              { onConflict: 'workspace_id,url' }
            )
          }
        } catch { /* skip */ }
      }

      if (signals.length === 0) continue

      const judged = await judgeSignals(signals)
      const observations = await extractObservations(judged, competitors as Competitor[])
      const result = await generateBriefing(observations, competitors as Competitor[])

      const { data: briefing } = await supabase
        .from('briefings')
        .insert({
          workspace_id: workspace.id,
          status: 'complete',
          executive_summary: result.executive_summary,
        })
        .select()
        .single()

      if (briefing && result.items.length > 0) {
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

      // send daily briefing email
      if (briefing) {
        const { data: items } = await supabase
          .from('briefing_items')
          .select('*')
          .eq('briefing_id', briefing.id)

        try {
          await sendBriefingEmail({
            to: user.email,
            briefing,
            items: (items ?? []) as BriefingItem[],
            competitors: competitors as Competitor[],
          })
        } catch { /* non-fatal */ }

        const highItems = (items ?? []).filter(i => i.severity === 'high')
        if (highItems.length > 0) {
          try {
            await sendHighSeverityAlert({
              to: user.email,
              items: highItems as BriefingItem[],
              competitors: competitors as Competitor[],
            })
          } catch { /* non-fatal */ }
        }
      }

      processed++
    } catch (err) {
      console.error(`Cron failed for workspace ${workspace.id}:`, err)
    }
  }

  return NextResponse.json({ ok: true, processed })
}
```

- [ ] **Step 3: Update vercel.json**

Replace entire file:

```json
{
  "crons": [
    { "path": "/api/keepalive", "schedule": "0 12 * * *" },
    { "path": "/api/cron/daily-brief", "schedule": "0 9 * * *" }
  ]
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 15 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/admin.ts app/api/cron/daily-brief/route.ts vercel.json
git commit -m "feat: add daily cron route for automated briefings across all workspaces"
```

---

### Task 11: Deployment — GitHub repo + Vercel production deploy

**Files:**
- Verify: `.gitignore` (ensure `.env.local` is excluded)
- Run: git init, GitHub push, Vercel deploy

**Interfaces:**
- Produces: live Vercel URL; GitHub repo at `https://github.com/<your-username>/competitive-intelligence-agent`

**Prerequisites:** Install GitHub CLI (`brew install gh`) and Vercel CLI (`npm i -g vercel`) if not already installed. You must be logged into both (`gh auth login`, `vercel login`).

- [ ] **Step 1: Verify .gitignore excludes secrets**

Open `.gitignore` and confirm it contains:
```
.env.local
.env*.local
```
If not present, add both lines. Also confirm `node_modules` and `.next` are excluded.

- [ ] **Step 2: Initialize git and make initial commit**

```bash
git add -A
git commit -m "feat: competitive intelligence agent v2 — production upgrade complete"
```

Expected: commit succeeds with all tracked files. `.env.local` should NOT appear in `git status`.

- [ ] **Step 3: Create GitHub repository and push**

```bash
gh repo create competitive-intelligence-agent --public --source=. --remote=origin --push
```

Expected: repo created at `https://github.com/<your-username>/competitive-intelligence-agent`, all commits pushed.

- [ ] **Step 4: Deploy to Vercel**

```bash
npx vercel --yes
```

When prompted: link to existing project = No, project name = `competitive-intelligence-agent`, root directory = `./`, override build settings = No.

Note the preview URL printed at the end (e.g. `https://competitive-intelligence-agent-abc123.vercel.app`). You will need this URL for the next steps.

- [ ] **Step 5: Set environment variables on Vercel**

Run each of these commands, pasting the value from your `.env.local`:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add GROQ_API_KEY production
vercel env add RESEND_API_KEY production
vercel env add CRON_SECRET production
```

For `NEXT_PUBLIC_SITE_URL`: use the production Vercel URL from Step 4:
```bash
vercel env add NEXT_PUBLIC_SITE_URL production
# value: https://competitive-intelligence-agent-<hash>.vercel.app
```

- [ ] **Step 6: Deploy to production**

```bash
npx vercel --prod
```

Expected: production deployment URL printed. Visit it — should load the login page.

- [ ] **Step 7: Run schema migrations in Supabase**

Open Supabase dashboard → SQL Editor. Paste and run the v2 additions from `db/schema.sql` (lines starting with `-- v2:`):

```sql
ALTER TABLE signals ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS signals_competitor_hash ON signals(competitor_id, content_hash);

CREATE TABLE IF NOT EXISTS processed_news_urls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  url text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, url)
);
ALTER TABLE processed_news_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace members only" ON processed_news_urls
  USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()));
```

- [ ] **Step 8: Configure Supabase auth URLs**

In Supabase dashboard → Authentication → URL Configuration:
- **Site URL:** your production Vercel URL (e.g. `https://competitive-intelligence-agent-abc123.vercel.app`)
- **Redirect URLs:** add `https://competitive-intelligence-agent-abc123.vercel.app/auth/callback`

- [ ] **Step 9: Verify production deployment**

Visit the production URL. Test:
1. Sign up with email/password — should work, redirect to dashboard
2. Password eye toggle — should show/hide password
3. "Forgot password?" link — should show the reset form
4. Sidebar — Dashboard, Competitors, Briefings links; Sign out button
5. Add a competitor — should appear without Notion/Linear/Asana being pre-seeded
6. Generate briefing — animated steps should run, briefing should appear

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore: deployment verified, all v2 features live"
git push
```

---

## Google OAuth Setup (Manual — Required After Deployment)

Google OAuth requires a one-time manual setup in Google Cloud Console. These are free steps:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → Create a new project (or use existing)
2. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret
6. In Supabase dashboard → Authentication → Providers → Google → paste Client ID + Secret → Enable

Test: visit your production URL → click "Continue with Google" → should redirect to Google → back to `/dashboard`.
