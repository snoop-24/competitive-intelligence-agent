import { createServerClient } from '@/lib/supabase/server'
import type { Briefing } from '@/lib/supabase/types'
import Link from 'next/link'

const statusStyle: Record<string, React.CSSProperties> = {
  complete:   { background: 'rgba(0,212,170,0.1)',  color: '#00D4AA', border: '1px solid rgba(0,212,170,0.2)'  },
  generating: { background: 'rgba(245,166,35,0.1)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.2)' },
  error:      { background: 'rgba(255,77,77,0.1)',  color: '#FF4D4D', border: '1px solid rgba(255,77,77,0.2)'  },
}

export default async function BriefingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('owner_id', user!.id).single()

  const briefings: Briefing[] = workspace
    ? (await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .order('generated_at', { ascending: false }).limit(20)).data ?? []
    : []

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.4px', color: 'var(--text)', marginBottom: 4 }}>
          Briefings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Your competitive intelligence history</p>
      </div>

      {briefings.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: 48, textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="20" height="20" fill="none" stroke="#A855F7" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 6 }}>No briefings yet</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>Generate your first competitive intelligence briefing from the dashboard.</p>
          <Link
            href="/dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--accent)', background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 6, padding: '7px 14px' }}
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {briefings.map(b => (
            <li key={b.id}>
              <Link
                href={`/briefings/${b.id}`}
                style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '16px 18px', textDecoration: 'none', transition: 'border-color 0.15s' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                    {new Date(b.generated_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize', flexShrink: 0, ...(statusStyle[b.status] ?? statusStyle.error) }}>
                    {b.status}
                  </span>
                </div>
                {b.executive_summary && (
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {b.executive_summary}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
