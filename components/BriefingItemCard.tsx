import type { BriefingItem, Competitor } from '@/lib/supabase/types'

const severityLeftBorder: Record<string, string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-amber-500',
  low: 'border-l-4 border-l-slate-600',
}

const severityBadge: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  low: 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
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
    <div className={`bg-slate-900 rounded-xl border border-slate-800 ${borderClass} overflow-hidden`}>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm text-white">{competitor?.name ?? 'Unknown'}</p>
            <p className="text-xs text-slate-500 mt-0.5 capitalize">{categoryLabel[item.category] ?? item.category}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize flex-shrink-0 ${badgeClass}`}>
            {item.severity}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">What changed</p>
            <p className="text-sm text-slate-300 leading-relaxed">{item.observation}</p>
          </div>
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3.5">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-1">Strategic interpretation</p>
            <p className="text-sm text-violet-200 leading-relaxed">{item.interpretation}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
