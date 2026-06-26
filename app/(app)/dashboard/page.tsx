import { createServerClient } from '@/lib/supabase/server'
import { GenerateButton } from '@/components/GenerateButton'
import Link from 'next/link'
import type { Competitor, Briefing, BriefingItem } from '@/lib/supabase/types'

const COMP_COLORS = ['#00D4AA','#A855F7','#22C55E','#F5A623','#58A6FF','#F78166','#E3B341','#79C0FF']

const CATEGORY_COLOR: Record<string, string> = {
  pricing: '#F5A623', product: '#22C55E', hiring: '#A855F7',
  news: '#58A6FF', positioning: '#79C0FF', other: '#8B949E',
}

const IMPACT_COLOR: Record<string, string> = {
  high: '#FF4D4D', medium: '#F5A623', low: '#8B949E',
}

function safeHostname(url: string) {
  try { return new URL(url).hostname } catch { return url }
}

function compAbbr(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let { data: workspace } = await supabase
    .from('workspaces').select('id, name').eq('owner_id', user!.id).single()

  if (!workspace) {
    const { data } = await supabase
      .from('workspaces')
      .insert({ name: user!.user_metadata?.company_name ?? 'My Workspace', owner_id: user!.id })
      .select('id, name').single()
    workspace = data
  }

  const competitors: Competitor[] = workspace
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id).order('created_at')).data ?? []
    : []

  const latestBriefing: Briefing | null = workspace
    ? ((await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .eq('status', 'complete').order('generated_at', { ascending: false }).limit(1)).data?.[0] ?? null)
    : null

  const briefingItems: BriefingItem[] = latestBriefing
    ? ((await supabase.from('briefing_items').select('*').eq('briefing_id', latestBriefing.id)).data ?? [])
    : []

  const sortedItems = [...briefingItems].sort((a, b) => {
    const ord = { high: 0, medium: 1, low: 2 }
    return (ord[a.severity as 'high'|'medium'|'low'] ?? 2) - (ord[b.severity as 'high'|'medium'|'low'] ?? 2)
  })

  const highCount = briefingItems.filter(i => i.severity === 'high').length

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div className="flex flex-col" style={{ height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div
        className="flex items-center flex-shrink-0 px-7"
        style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        <span style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.4px', color: 'var(--text)' }}>
          Dashboard
        </span>
        <div className="mx-4 flex-shrink-0" style={{ width: 1, height: 18, background: 'var(--border-2)' }} />
        <span style={{ fontSize: 13, color: 'var(--dim)' }}>{dateStr}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Live</span>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div
        className="flex items-center flex-shrink-0 px-7 gap-6"
        style={{ height: 76, background: 'var(--bg-deep)', borderBottom: '1px solid var(--border)' }}
      >
        <KpiStat label="COMPETITORS" value={competitors.length} color="var(--text)" />
        <VRule />
        <KpiStat label="FINDINGS" value={briefingItems.length} color="var(--text)" />
        <VRule />
        <KpiStat label="HIGH PRIORITY" value={highCount} color="var(--alert)" />
        <VRule />
        <KpiStat
          label="LAST BRIEFED"
          value={latestBriefing
            ? new Date(latestBriefing.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—'}
          color="var(--muted)"
        />

        {/* AI query / generate bar */}
        <div className="ml-auto">
          <GenerateButton />
        </div>
      </div>

      {/* ── Two-column content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left column */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ borderRight: '1px solid var(--border)' }}>

          {/* AI Intelligence Brief */}
          {latestBriefing?.executive_summary ? (
            <div
              className="relative overflow-hidden"
              style={{
                borderRadius: 10, padding: 20,
                background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.04) 60%, rgba(14,165,233,0.03) 100%)',
                border: '1px solid rgba(168,85,247,0.2)',
              }}
            >
              <div className="absolute" style={{ width: 150, height: 150, top: -30, right: -30, background: 'radial-gradient(circle, rgba(168,85,247,0.1), transparent 70%)' }} />
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ borderRadius: 6, background: 'linear-gradient(135deg, #A855F7, #6366F1)' }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="white"/></svg>
                </div>
                <span style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 11, letterSpacing: '0.06em', color: '#C4B5FD', textTransform: 'uppercase' }}>
                  AI Intelligence Brief
                </span>
                <span className="ml-auto" style={{ fontSize: 11, color: '#6B7280', background: 'rgba(168,85,247,0.08)', padding: '2px 8px', borderRadius: 4 }}>
                  {new Date(latestBriefing.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.65, color: '#C4B5FD' }}>{latestBriefing.executive_summary}</p>
              <div className="flex gap-2 mt-4">
                <Link
                  href={`/briefings/${latestBriefing.id}`}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#C4B5FD' }}
                >
                  Full Report →
                </Link>
                <Link
                  href="/briefings"
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', color: 'var(--accent)' }}
                >
                  All Briefings
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: 10, padding: 20, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No briefing yet — click Generate above to run your first analysis.</p>
            </div>
          )}

          {/* Competitor Activity */}
          {competitors.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  Competitor Activity
                </span>
                <Link href="/competitors" style={{ fontSize: 11, color: 'var(--muted)' }}>Manage →</Link>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {competitors.map((c, i) => {
                  const color = COMP_COLORS[i % COMP_COLORS.length]
                  const count = briefingItems.filter(b => b.competitor_id === c.id).length
                  return (
                    <Link
                      key={c.id}
                      href="/competitors"
                      style={{ width: 'calc(50% - 4px)', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '11px 12px', display: 'block' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex-shrink-0 flex items-center justify-center"
                          style={{ width: 30, height: 30, borderRadius: 6, background: `${color}1a`, color, fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 9, letterSpacing: '-0.3px' }}
                        >
                          {compAbbr(c.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                          <p style={{ fontSize: 10, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeHostname(c.website_url)}</p>
                        </div>
                        {count > 0 && (
                          <span style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 14, color, flexShrink: 0 }}>{count}</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: 8, padding: 20, background: 'var(--surface)', border: '1px solid var(--border-2)', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>No competitors tracked yet.</p>
              <Link
                href="/competitors"
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: 'var(--accent)' }}
              >
                Add Competitor →
              </Link>
            </div>
          )}
        </div>

        {/* Right column — Signal stream */}
        <div style={{ width: 520, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab bar */}
          <div
            className="flex items-center px-4 flex-shrink-0"
            style={{ height: 52, borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}
          >
            <button style={{ padding: '14px 12px', fontSize: 13, fontWeight: 500, color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }}>
              All
              {briefingItems.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 20, background: 'rgba(0,212,170,0.15)', color: 'var(--accent)' }}>
                  {briefingItems.length}
                </span>
              )}
            </button>
            {['High', 'Pricing', 'Product', 'Hiring'].map(t => (
              <button key={t} style={{ padding: '14px 12px', fontSize: 13, color: 'var(--dim)' }}>{t}</button>
            ))}
          </div>

          {/* Signal cards */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {sortedItems.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center' }}>
                  {competitors.length === 0
                    ? 'Add competitors to start tracking signals.'
                    : 'No signals yet. Generate a briefing to see findings here.'}
                </p>
              </div>
            ) : (
              sortedItems.map(item => {
                const competitor = competitors.find(c => c.id === item.competitor_id)
                const ci = competitors.findIndex(c => c.id === item.competitor_id)
                const compColor = COMP_COLORS[ci >= 0 ? ci % COMP_COLORS.length : 0]
                const typeColor = CATEGORY_COLOR[item.category] ?? '#8B949E'
                const impactColor = IMPACT_COLOR[item.severity] ?? '#8B949E'

                return (
                  <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '13px 14px' }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span style={{ fontSize: 11, fontWeight: 600, color: compColor }}>
                        {competitor?.name ?? 'Unknown'}
                      </span>
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: typeColor }} />
                      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{item.category}</span>
                      <div className="ml-auto w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: impactColor }} />
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--text)' }}>{item.observation}</p>
                    {item.interpretation && (
                      <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--muted)', marginTop: 8, paddingLeft: 10, borderLeft: '2px solid rgba(168,85,247,0.3)' }}>
                        {item.interpretation}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex-shrink-0">
      <div style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 30, lineHeight: 1, letterSpacing: '-1px', color }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function VRule() {
  return <div className="flex-shrink-0" style={{ width: 1, height: 38, background: 'var(--border)' }} />
}
