import type { BriefingItem, Competitor } from '@/lib/supabase/types'

const COMP_COLORS = ['#00D4AA','#A855F7','#22C55E','#F5A623','#58A6FF','#F78166','#E3B341','#79C0FF']

const CATEGORY_COLOR: Record<string, string> = {
  pricing: '#F5A623', product: '#22C55E', hiring: '#A855F7',
  news: '#58A6FF', positioning: '#79C0FF', other: '#8B949E',
}

const IMPACT_COLOR: Record<string, string> = {
  high: '#FF4D4D', medium: '#F5A623', low: '#8B949E',
}

export function BriefingItemCard({ item, competitors }: { item: BriefingItem; competitors: Competitor[] }) {
  const competitorIdx = competitors.findIndex(c => c.id === item.competitor_id)
  const competitor = competitors[competitorIdx]
  const compColor = COMP_COLORS[competitorIdx >= 0 ? competitorIdx % COMP_COLORS.length : 0]
  const typeColor = CATEGORY_COLOR[item.category] ?? '#8B949E'
  const impactColor = IMPACT_COLOR[item.severity] ?? '#8B949E'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '13px 14px' }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: 11, fontWeight: 600, color: compColor }}>
          {competitor?.name ?? 'Unknown'}
        </span>
        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: typeColor }} />
        <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{item.category}</span>
        <div className="ml-auto w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: impactColor }} />
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text)', marginBottom: item.interpretation ? 10 : 0 }}>
        {item.observation}
      </p>

      {item.interpretation && (
        <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', borderLeft: '3px solid rgba(168,85,247,0.4)' }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#A855F7', marginBottom: 4 }}>
            Strategic interpretation
          </p>
          <p style={{ fontSize: 12, lineHeight: 1.55, color: '#C4B5FD' }}>
            {item.interpretation}
          </p>
        </div>
      )}
    </div>
  )
}
