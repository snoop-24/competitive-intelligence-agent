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
  if (!workspaces?.length) return NextResponse.json({ processed: 0 })

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

  return NextResponse.json({ processed })
}
