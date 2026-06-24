'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Competitor } from '@/lib/supabase/types'

export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
    setDeleting(null)
    router.refresh()
  }

  if (competitors.length === 0) {
    return <p className="text-gray-500 text-sm">No competitors added yet.</p>
  }

  return (
    <ul className="space-y-2">
      {competitors.map(c => (
        <li key={c.id} className="flex items-center justify-between bg-white border rounded-lg px-4 py-3">
          <div>
            <p className="font-medium text-sm">{c.name}</p>
            <a href={c.website_url} target="_blank" rel="noreferrer"
              className="text-xs text-blue-500 hover:underline truncate max-w-xs block">
              {c.website_url}
            </a>
            {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
          </div>
          <button
            onClick={() => handleDelete(c.id)}
            disabled={deleting === c.id}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 ml-4"
          >
            {deleting === c.id ? 'Removing...' : 'Remove'}
          </button>
        </li>
      ))}
    </ul>
  )
}
