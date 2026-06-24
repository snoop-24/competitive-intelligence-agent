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
      setError('Failed to start analysis. Please try again.')
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
                  // mark all steps before this one complete
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
    <div className="space-y-4">
      <button
        onClick={generate}
        disabled={running}
        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm transition-colors"
      >
        {running ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Briefing
          </>
        )}
      </button>

      {running && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Running analysis</p>
          {STEPS.map((step, idx) => {
            const isComplete = completedSteps.has(idx)
            const isActive = activeStep === idx && !isComplete
            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {isComplete ? (
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <svg className="w-4 h-4 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                  )}
                </div>
                <span className={`text-sm ${isComplete ? 'text-gray-500 line-through' : isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                  {step}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>
      )}
    </div>
  )
}
