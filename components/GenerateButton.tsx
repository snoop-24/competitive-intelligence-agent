'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STEPS = [
  'Fetching competitor websites',
  'Fetching news coverage',
  'Analyzing signal relevance',
  'Extracting structured observations',
  'Generating strategic briefing',
]

function stepIndexFromMessage(msg: string): number {
  if (msg.includes('websites')) return 0
  if (msg.includes('news')) return 1
  if (msg.includes('signal') || msg.includes('meaningful')) return 2
  if (msg.includes('observations')) return 3
  if (msg.includes('briefing') || msg.includes('strategic')) return 4
  return -1
}

export function GenerateButton() {
  const [running, setRunning] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const router = useRouter()

  async function generate() {
    setRunning(true)
    setActiveStep(0)
    setCompletedSteps(new Set())
    setError('')

    const response = await fetch('/api/analyze', { method: 'POST' })
    if (!response.ok || !response.body) {
      setError('Failed to start analysis.')
      setRunning(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let eventType = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'progress' && data.message) {
              const idx = stepIndexFromMessage(data.message)
              if (idx >= 0) {
                setCompletedSteps(prev => {
                  const next = new Set(prev)
                  for (let i = 0; i < idx; i++) next.add(i)
                  return next
                })
                setActiveStep(idx)
              }
            } else if (eventType === 'complete' && data.briefing_id) {
              setCompletedSteps(new Set([0, 1, 2, 3, 4]))
              setRunning(false)
              router.push(`/briefings/${data.briefing_id}`)
              return
            } else if (eventType === 'error') {
              setError(data.message ?? 'Analysis failed')
              setRunning(false)
              return
            }
          } catch { /* ignore parse errors */ }
          eventType = ''
        }
      }
    }
    setRunning(false)
  }

  return (
    <div>
      {!running && (
        <button
          onClick={generate}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(90deg, rgba(0,212,170,0.1), rgba(0,212,170,0.06))',
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: 8, padding: '10px 16px',
            fontFamily: 'var(--font-dm-sans)', fontSize: 12, fontWeight: 500, color: 'var(--accent)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Generate Brief
        </button>
      )}

      {running && (
        <div style={{ minWidth: 260, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '12px 14px' }}>
          <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--dim)', marginBottom: 10 }}>
            Running analysis
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {STEPS.map((step, idx) => {
              const isComplete = completedSteps.has(idx)
              const isActive = activeStep === idx && !isComplete
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isComplete ? (
                      <svg width="16" height="16" fill="none" stroke="#00D4AA" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : isActive ? (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#A855F7" strokeWidth={3} style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path strokeOpacity="0.75" fill="#A855F7" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--border-3)' }} />
                    )}
                  </div>
                  <span style={{
                    fontSize: 12,
                    color: isComplete ? 'var(--dim)' : isActive ? 'var(--text)' : 'var(--dim)',
                    fontWeight: isActive ? 500 : 400,
                    textDecoration: isComplete ? 'line-through' : 'none',
                  }}>
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: 'var(--alert)', marginTop: 8 }}>{error}</p>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
