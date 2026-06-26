'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Competitor } from '@/lib/supabase/types'

const COMP_COLORS = ['#00D4AA','#A855F7','#22C55E','#F5A623','#58A6FF','#F78166','#E3B341','#79C0FF']

function compAbbr(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function safeHostname(url: string) {
  try { return new URL(url).hostname } catch { return url }
}

export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(id: string) {
    setDeleting(id)
    setDeleteError(null)
    const res = await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
    setDeleting(null)
    if (!res.ok) {
      setDeleteError('Failed to remove competitor')
    } else {
      router.refresh()
    }
  }

  if (competitors.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>No competitors added yet. Use the form above to add one.</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, overflow: 'hidden' }}>
      {deleteError && (
        <div style={{ background: 'rgba(255,77,77,0.1)', borderBottom: '1px solid rgba(255,77,77,0.2)', padding: '10px 16px', fontSize: 12, color: 'var(--alert)' }}>
          {deleteError}
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {competitors.map((c, i) => {
          const color = COMP_COLORS[i % COMP_COLORS.length]
          return (
            <li
              key={c.id}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: i < competitors.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              {/* Avatar */}
              <div
                style={{ width: 32, height: 32, borderRadius: 6, background: `${color}1a`, color, fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 9, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                {compAbbr(c.name)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </p>
                <a
                  href={c.website_url} target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 320 }}
                >
                  {safeHostname(c.website_url)}
                </a>
                {c.description && (
                  <p style={{ fontSize: 11, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                    {c.description}
                  </p>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deleting === c.id}
                style={{ fontSize: 11, color: 'var(--dim)', background: 'none', border: 'none', cursor: deleting === c.id ? 'not-allowed' : 'pointer', opacity: deleting === c.id ? 0.5 : 1, flexShrink: 0, padding: '4px 8px', borderRadius: 4 }}
                onMouseEnter={e => { if (deleting !== c.id) (e.currentTarget as HTMLElement).style.color = 'var(--alert)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--dim)' }}
              >
                {deleting === c.id ? 'Removing...' : 'Remove'}
              </button>
            </li>
          )
        })}
      </ul>

      {/* Add row */}
      <div style={{ padding: '10px 16px', borderTop: competitors.length > 0 ? '1px solid var(--border)' : 'none' }}>
        <a
          href="/competitors"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 5, border: '1px dashed var(--border-3)', fontSize: 11, color: 'var(--dim)', textDecoration: 'none' }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 1v10M1 6h10" /></svg>
          Add competitor
        </a>
      </div>
    </div>
  )
}
