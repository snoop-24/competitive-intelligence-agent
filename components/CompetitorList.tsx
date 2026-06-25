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
      <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm flex-shrink-0">
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
      className="w-9 h-9 rounded-lg object-contain flex-shrink-0 bg-slate-800 border border-slate-700 p-1"
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
    setDeleting(null)
    if (!res.ok) {
      setDeleteError('Failed to remove competitor')
    } else {
      router.refresh()
    }
  }

  if (competitors.length === 0) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
        <p className="text-sm text-slate-500">No competitors added yet. Use the form above to add one.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      {deleteError && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 px-4 py-3 text-sm">{deleteError}</div>
      )}
      <ul className="divide-y divide-slate-800">
        {competitors.map(c => (
          <li key={c.id} className="flex items-center gap-4 px-5 py-4">
            <CompetitorFavicon url={c.website_url} name={c.name} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-white">{c.name}</p>
              <a
                href={c.website_url} target="_blank" rel="noreferrer"
                className="text-xs text-violet-400 hover:underline truncate block max-w-sm"
              >
                {c.website_url}
              </a>
              {c.description && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{c.description}</p>
              )}
            </div>
            <button
              onClick={() => handleDelete(c.id)}
              disabled={deleting === c.id}
              className="text-xs text-slate-600 hover:text-red-400 disabled:opacity-40 transition-colors flex-shrink-0 ml-2"
            >
              {deleting === c.id ? 'Removing...' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
