'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AddCompetitorForm() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to add competitor')
      setLoading(false)
      return
    }
    setName('')
    setDescription('')
    setLoading(false)
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--border-2)',
    borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--text)',
    outline: 'none', fontFamily: 'var(--font-dm-sans)',
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
          Add Competitor
        </p>
        <p style={{ fontSize: 12, color: 'var(--dim)' }}>
          Enter a company name — we&apos;ll automatically discover what to monitor.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginBottom: 5 }}>
            Company name
          </label>
          <input
            placeholder="e.g. Notion, Linear, Figma"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginBottom: 5 }}>
            Description <span style={{ color: 'var(--dim)' }}>(optional)</span>
          </label>
          <input
            placeholder="What they do"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--alert)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: loading ? 'rgba(0,212,170,0.06)' : 'rgba(0,212,170,0.1)',
          border: '1px solid rgba(0,212,170,0.25)', borderRadius: 6,
          padding: '8px 16px', fontSize: 13, fontWeight: 500, color: 'var(--accent)',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          fontFamily: 'var(--font-dm-sans)',
        }}
      >
        {loading ? (
          <>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path strokeOpacity="0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Discovering {name || 'company'}...
          </>
        ) : (
          <>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Add Competitor
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
