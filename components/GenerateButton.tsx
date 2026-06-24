'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProgressStep {
  message: string
}

export function GenerateButton() {
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<ProgressStep[]>([])
  const [error, setError] = useState('')
  const router = useRouter()

  async function generate() {
    setRunning(true)
    setSteps([])
    setError('')

    const response = await fetch('/api/analyze', { method: 'POST' })
    if (!response.ok || !response.body) {
      setError('Failed to start analysis')
      setRunning(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      let eventType = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'progress' && data.message) {
              setSteps(prev => [...prev, { message: data.message }])
            } else if (eventType === 'complete' && data.briefing_id) {
              setRunning(false)
              router.push(`/briefings/${data.briefing_id}`)
              return
            } else if (eventType === 'error') {
              setError(data.message ?? 'Analysis failed')
              setRunning(false)
              return
            }
          } catch {}
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
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? 'Analyzing...' : 'Generate Briefing'}
      </button>

      {steps.length > 0 && (
        <ul className="space-y-1 text-sm text-gray-600">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              {step.message}
            </li>
          ))}
          {running && (
            <li className="flex items-center gap-2 text-blue-500">
              <span className="animate-pulse">⟳</span>
              Working...
            </li>
          )}
        </ul>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
}
