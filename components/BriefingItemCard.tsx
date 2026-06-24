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
