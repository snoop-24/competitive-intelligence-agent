import { createServerClient } from '@/lib/supabase/server'
import type { Briefing } from '@/lib/supabase/types'
import Link from 'next/link'

const statusBadge: Record<string, string> = {
  complete: 'bg-green-500/10 text-green-400 border border-green-500/20',
  generating: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

export default async function BriefingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  const briefings: Briefing[] = workspace
    ? (await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .order('generated_at', { ascending: false }).limit(20)).data ?? []
    : []

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Briefings</h1>
        <p className="text-sm text-slate-500 mt-1">Your competitive intelligence history</p>
      </div>

      {briefings.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-12 text-center">
          <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No briefings yet</h3>
          <p className="text-sm text-slate-500 mb-5">Generate your first competitive intelligence briefing from the dashboard.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {briefings.map(b => (
            <li key={b.id}>
              <Link
                href={`/briefings/${b.id}`}
                className="block bg-slate-900 rounded-xl border border-slate-800 p-5 hover:border-violet-500/50 hover:bg-slate-800/50 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-semibold text-white">
                    {new Date(b.generated_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize flex-shrink-0 ${statusBadge[b.status] ?? 'bg-slate-500/10 text-slate-400'}`}>
                    {b.status}
                  </span>
                </div>
                {b.executive_summary && (
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">{b.executive_summary}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
