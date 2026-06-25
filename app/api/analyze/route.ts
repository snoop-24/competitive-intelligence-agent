import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
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
          let origin = competitor.website_url
          try { origin = new URL(competitor.website_url).origin } catch { /* keep as-is */ }

          const urlsToScrape = [
            competitor.website_url,
            `${origin}/pricing`,
            `${origin}/blog`,
            `${origin}/changelog`,
          ]

          for (const pageUrl of urlsToScrape) {
            try {
              const content = await scrapeUrl(pageUrl)
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
                url: pageUrl,
              })

              await supabase.from('signals').insert({
                competitor_id: competitor.id,
                source_type: 'website',
                raw_content: content.slice(0, 3000),
                url: pageUrl,
                content_hash: hash,
                is_meaningful: null,
              })
            } catch { /* skip pages that fail or 404 */ }
          }
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
              items: highItems as unknown as Parameters<typeof sendHighSeverityAlert>[0]['items'],
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
