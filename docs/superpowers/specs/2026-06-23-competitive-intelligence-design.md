# Competitive Intelligence Agent — Design Spec

**Date:** 2026-06-23  
**Deadline:** Friday 2026-06-27 (hackathon demo)  
**Status:** Approved

---

## Problem

Companies spend 5–10 hours per week having a person manually read news, check pricing pages, monitor job postings, and write a summary report. The output is a digest that executives skim. The work is repetitive, slow, and produces surface-level observations ("they updated their pricing page") rather than strategic insight ("they dropped enterprise pricing 20%, likely responding to Q3 churn pressure").

---

## What We're Building

A web app that lets companies define a list of competitors, then automatically monitors their websites and news coverage, detects meaningful changes, and generates a structured briefing with actual strategic interpretation — not just a summary of what changed, but an inference about *why* and *what it means*.

---

## Stack (All Free, No Credit Card Required)

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js 14 App Router (TypeScript) | Full-stack, Vercel-native |
| Auth + DB | Supabase (free tier) | Auth + Postgres in one, no infra |
| Web scraping | Jina AI Reader (`r.jina.ai`) | Free, no API key, handles JS-rendered pages |
| News | Google News RSS | No API key, no rate limits at demo scale |
| AI synthesis | Groq API — Llama 3.3 70B (free tier) | Fast, generous free limits, no credit card |
| Email | Resend (sandbox mode, free tier) | 3K emails/month, works without custom domain |
| Hosting | Vercel Hobby (free) | Zero-config deploy |
| Job scheduling | None for v1 — manual trigger | Reduces complexity; streaming looks better in demo |

---

## Architecture

```
Browser
  └── Next.js App (Vercel)
        ├── /app — UI pages (dashboard, competitors, briefings)
        ├── /app/api/analyze — Server Action: triggers scrape + synthesis
        └── /lib
              ├── scraper.ts       — Jina AI Reader fetch wrapper
              ├── news.ts          — Google News RSS parser
              ├── synthesizer.ts   — 3-layer Groq synthesis pipeline
              └── supabase.ts      — DB client

Supabase
  ├── Auth (email/password)
  └── Postgres (schema below)
```

No background job queue for v1. The "Generate Briefing" button hits a Next.js Route Handler (`/api/analyze`) that runs scrape → synthesis inline, streaming progress updates to the UI via `ReadableStream` + `EventSource`. This is simpler to build and more visually impressive in a demo than a background job.

---

## Data Model

```sql
-- One workspace per user for v1 (no invite flow)
workspaces
  id uuid PK
  name text
  owner_id uuid FK → auth.users
  created_at timestamptz

competitors
  id uuid PK
  workspace_id uuid FK → workspaces
  name text
  website_url text          -- homepage or key URL to monitor
  description text          -- optional context about what they do
  created_at timestamptz

signals
  id uuid PK
  competitor_id uuid FK → competitors
  source_type text          -- 'website' | 'news'
  raw_content text          -- scraped markdown or news item text
  url text
  fetched_at timestamptz
  is_meaningful boolean     -- set by LLM judge step

briefings
  id uuid PK
  workspace_id uuid FK → workspaces
  generated_at timestamptz
  status text               -- 'generating' | 'complete' | 'error'
  executive_summary text    -- 2-3 sentence strategic overview

briefing_items
  id uuid PK
  briefing_id uuid FK → briefings
  competitor_id uuid FK → competitors
  category text             -- 'pricing' | 'product' | 'hiring' | 'news' | 'positioning'
  observation text          -- what changed (factual)
  interpretation text       -- why it matters (strategic inference)
  severity text             -- 'high' | 'medium' | 'low'
  source_urls text[]        -- evidence links
```

---

## AI Synthesis Pipeline (3-Layer)

This is the core intellectual engine. Each layer is a separate Groq call.

### Layer 1 — Signal Judge
For each scraped page/news item, ask: *"Is this a meaningful competitive signal or noise?"*

```
Input:  raw scraped content (markdown from Jina)
Output: { is_meaningful: bool, reason: string, category: string }
```

Filters out unchanged pages, irrelevant news, boilerplate. Only meaningful signals proceed.

### Layer 2 — Structured Observations
For each meaningful signal, extract structured facts.

```
Input:  meaningful signals grouped by competitor
Output: [{ competitor, what_changed, evidence, category, severity }]
```

Turns raw text into structured competitive observations without interpretation yet.

### Layer 3 — Strategic Interpretation
Given all observations across all competitors, generate the briefing narrative.

```
Input:  all structured observations for the workspace
Output: {
  executive_summary: string,  -- 2-3 sentences, cross-competitor synthesis
  items: [{
    competitor,
    observation,              -- factual (from layer 2)
    interpretation,           -- "this likely means..." (inference)
    severity
  }]
}
```

This is where the system goes from "Competitor A updated pricing" to "Competitor A dropped enterprise tier 20% — combined with their recent job postings for enterprise sales reps, this signals an aggressive push into mid-market before their Series B."

---

## UI — Pages and Screens

### `/` — Landing / Auth
Simple sign-up / sign-in form via Supabase Auth UI. After auth, redirect to `/dashboard`.

### `/dashboard` — Main View
- List of competitors with last-analyzed timestamp
- "Generate Briefing" button (primary CTA)
- Latest briefing summary card (if one exists)
- Link to full briefing history

### `/competitors` — Competitor Management
- Add competitor: name, website URL, optional description
- List view with edit/delete
- For demo: pre-seed 2–3 competitors on first login

### `/briefings/[id]` — Briefing Detail
- Executive summary at top (cross-competitor narrative)
- Competitor cards below, each with:
  - Category badge (pricing / product / news / positioning)
  - Severity indicator (high / medium / low)
  - Observation (factual)
  - Interpretation (strategic inference, visually distinct)
  - Source links
- "Email this briefing" button (sends via Resend sandbox to user's own email)

### Streaming Progress UI (during generation)
While the Server Action runs, the UI shows a live progress feed:
```
✓ Fetching competitor websites...
✓ Fetching news coverage...
✓ Judging signal relevance (12 signals found, 4 meaningful)...
✓ Extracting structured observations...
✓ Generating strategic briefing...
```
This is the demo moment. It shows the agent thinking.

---

## Demo Flow (Hackathon)

1. Open app → sign up in 10 seconds (Supabase magic link or email/password)
2. Dashboard shows 2–3 pre-seeded competitors (Notion, Linear, Asana — or user's actual competitors)
3. Click "Generate Briefing"
4. Watch the streaming progress UI run through all 5 steps (~15–30 seconds)
5. Briefing appears with strategic narrative including inferences
6. Click into a briefing item to see observation vs interpretation side-by-side
7. Click "Email this briefing" → check email

That's the full demo. 7 steps, under 2 minutes.

---

## Scope — What's In v1 vs Later

### In v1 (hackathon)
- Email/password auth + one workspace per user
- Add / edit / delete competitors
- Manual "Generate Briefing" trigger
- Website scraping via Jina AI Reader
- Google News RSS monitoring
- 3-layer Groq synthesis pipeline
- Briefing detail page with observation + interpretation
- Email briefing to self (Resend sandbox)
- Streaming progress UI during generation

### Explicitly Out of v1
- Scheduled / automatic monitoring (Inngest cron)
- Job postings monitoring (careers page scraping)
- Multi-user workspaces / team invites
- Slack integration
- Custom domain email
- Briefing comparison / history trending
- Competitor auto-discovery (user provides URLs manually)
- Mobile-responsive design (desktop first for demo)

---

## Key Implementation Notes

**Jina scraper:** `GET https://r.jina.ai/{url}` with `Accept: text/markdown` header. Returns clean markdown of any page. Store the result as `raw_content` in `signals`. On next run, compare to detect changes.

**Google News RSS:** `https://news.google.com/rss/search?q={encodeURIComponent(name)}&hl=en-US&gl=US&ceid=US:en` — parse with `fast-xml-parser`. Extract title + description + link for each item from the last 7 days.

**Groq setup:** `npm install groq-sdk`. Use `groq.chat.completions.create()` with model `llama-3.3-70b-versatile`. Use structured outputs (JSON mode) for layers 1 and 2 to guarantee parseable output.

**Streaming progress:** Use Next.js `ReadableStream` returned from a Route Handler (not a Server Action, which can't stream). Client polls or uses `EventSource` to receive step completion events and updates the UI.

**Supabase keepalive:** Add a lightweight daily ping (`SELECT 1`) via a Vercel Cron job (`vercel.json` cron config) to prevent the free-tier project from pausing.

**Pre-seeded demo data:** On first login, auto-create a workspace and insert 2–3 competitor rows so the user lands on a populated dashboard rather than an empty state.
