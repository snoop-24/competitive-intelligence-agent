'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Competitor } from '@/lib/supabase/types'

function CompetitorFavicon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)
  let domain = ''
  try { domain = new URL(url).hostname } catch { /* invalid url */ }

  if (failed || !domain) {
    return (
      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
        {name[0]?.toUpperCase() ?? '?'}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={36}
      height={36}
      className="w-9 h-9 rounded-lg object-contain flex-shrink-0 bg-gray-50 border border-gray-100 p-1"
      onError={() => setFailed(true)}
    />
  )
}

export function CompetitorList({ competitors }: { competitors: Competitor[] }) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete(id: string) {
    setDeleting(id)
    setDeleteError(null)
    const res = await fetch(`/api/competitors/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setDeleteError('Failed to remove competitor')
    }
    setDeleting(null)
    router.refresh()
  }

  if (competitors.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <p className="text-sm text-gray-500">No competitors added yet. Use the form above to add one.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {deleteError && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-3 text-sm">{deleteError}</div>
      )}
      <ul className="divide-y divide-gray-100">
        {competitors.map(c => (
          <li key={c.id} className="flex items-center gap-4 px-5 py-4">
            <CompetitorFavicon url={c.website_url} name={c.name} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900">{c.name}</p>
              <a
                href={c.website_url} target="_blank" rel="noreferrer"
                className="text-xs text-indigo-600 hover:underline truncate block max-w-sm"
              >
                {c.website_url}
              </a>
              {c.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{c.description}</p>
              )}
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              disabled={deleting === c.id}
              className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors flex-shrink-0 ml-2"
            >
              {deleting === c.id ? 'Removing...' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
