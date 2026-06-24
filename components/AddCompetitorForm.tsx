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
    setName(''); setUrl(''); setDescription('')
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <input
          placeholder="Company name" value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          placeholder="https://competitor.com/pricing" value={url}
          onChange={e => setUrl(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          required type="url"
        />
      </div>
      <input
        placeholder="Brief description (optional)" value={description}
        onChange={e => setDescription(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Adding...' : 'Add Competitor'}
      </button>
    </form>
  )
}
