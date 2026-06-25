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
          <Link href="/briefings" className="text-sm text-violet-600 hover:underline mb-2 inline-block">
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
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100 rounded-xl p-6">
          <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-2">Executive Summary</p>
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
