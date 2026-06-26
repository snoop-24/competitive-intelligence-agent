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

  const { data: briefing } = await supabase.from('briefings').select('*').eq('id', id).single()
  if (!briefing) notFound()

  const { data: items } = await supabase.from('briefing_items').select('*').eq('briefing_id', id)

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user!.id).single()
  const { data: competitors } = workspace
    ? await supabase.from('competitors').select('*').eq('workspace_id', workspace.id)
    : { data: [] }

  const sortedItems = (items ?? []).sort((a, b) => {
    const ord = { high: 0, medium: 1, low: 2 }
    return (ord[a.severity as 'high'|'medium'|'low'] ?? 2) - (ord[b.severity as 'high'|'medium'|'low'] ?? 2)
  })

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 32px' }}>

      {emailed === 'true' && (
        <div style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--accent)', marginBottom: 20 }}>
          Briefing emailed successfully.
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
        <div>
          <Link href="/briefings" style={{ display: 'inline-block', fontSize: 12, color: 'var(--accent)', marginBottom: 8, textDecoration: 'none' }}>
            ← All Briefings
          </Link>
          <h1 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.4px', color: 'var(--text)', marginBottom: 4 }}>
            Competitive Briefing
          </h1>
          <p style={{ fontSize: 13, color: 'var(--dim)' }}>
            {new Date(briefing.generated_at).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <a
          href={`/api/briefings/${id}/email`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, fontSize: 12, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '7px 12px', textDecoration: 'none' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Email briefing
        </a>
      </div>

      {/* Executive summary */}
      {briefing.executive_summary && (
        <div
          style={{
            borderRadius: 10, padding: '18px 20px', marginBottom: 24, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(99,102,241,0.04) 60%, rgba(14,165,233,0.03) 100%)',
            border: '1px solid rgba(168,85,247,0.2)',
          }}
        >
          <div style={{ position: 'absolute', width: 120, height: 120, top: -20, right: -20, background: 'radial-gradient(circle, rgba(168,85,247,0.1), transparent 70%)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg, #A855F7, #6366F1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z" fill="white"/></svg>
            </div>
            <span style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#C4B5FD' }}>
              Executive Summary
            </span>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: '#C4B5FD' }}>{briefing.executive_summary}</p>
        </div>
      )}

      {/* Findings */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--dim)', marginBottom: 14 }}>
          {sortedItems.length} Finding{sortedItems.length !== 1 ? 's' : ''}
        </p>

        {sortedItems.length === 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>No significant signals detected this period.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedItems.map(item => (
              <BriefingItemCard
                key={item.id}
                item={item as BriefingItem}
                competitors={(competitors ?? []) as Competitor[]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
