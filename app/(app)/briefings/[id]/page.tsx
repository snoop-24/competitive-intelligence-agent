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
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      {emailed === 'true' && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
          Briefing emailed successfully!
        </div>
      )}

      <div className="flex items-center justify-between">
        <Link href="/briefings" className="text-sm text-blue-600 hover:underline">← All Briefings</Link>
        <a href={`/api/briefings/${id}/email`} className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
          Email this briefing
        </a>
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
