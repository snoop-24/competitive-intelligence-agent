'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AddCompetitorForm() {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
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
      body: JSON.stringify({ name, website_url: url, description }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Failed to add competitor')
      setLoading(false)
      return
    }
    setName('')
    setUrl('')
    setDescription('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-4">
      <h2 className="font-semibold text-white">Add Competitor</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Company name</label>
          <input
            placeholder="e.g. Notion" value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">URL to monitor</label>
          <input
            placeholder="https://competitor.com/pricing" value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            required type="url"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Description <span className="text-slate-600">(optional)</span></label>
        <input
          placeholder="Brief description of what they do" value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm">{error}</div>
      )}
      <button
        type="submit" disabled={loading}
        className="bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Adding...' : 'Add Competitor'}
      </button>
    </form>
  )
}
