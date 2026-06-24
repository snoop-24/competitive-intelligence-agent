import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { scrapeUrl } from '@/lib/scraper'
import { fetchNews } from '@/lib/news'
import { judgeSignals, extractObservations, generateBriefing, type RawSignal } from '@/lib/synthesizer'
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
