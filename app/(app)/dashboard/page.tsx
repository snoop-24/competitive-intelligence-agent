import { createServerClient } from '@/lib/supabase/server'
import { GenerateButton } from '@/components/GenerateButton'
import Link from 'next/link'
import type { Competitor, Briefing } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('owner_id', user!.id)
    .single()

  if (!workspace) {
    const { data } = await supabase
      .from('workspaces')
      .insert({ name: user!.user_metadata?.company_name ?? 'My Workspace', owner_id: user!.id })
      .select('id, name')
      .single()
    workspace = data
  }

  const competitors: Competitor[] = workspace
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id).order('created_at')).data ?? []
    : []

  const latestBriefing: Briefing | null = workspace
    ? ((await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .eq('status', 'complete').order('generated_at', { ascending: false }).limit(1)).data?.[0] ?? null)
    : null

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{workspace?.name}</p>
      </div>

      {competitors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No competitors tracked yet</h3>
          <p className="text-sm text-gray-500 mb-5 max-w-xs mx-auto">
            Add your first competitor to start generating AI-powered intelligence briefings.
          </p>
          <Link
            href="/competitors"
            className="inline-flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Add Competitor
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Generate Briefing</h2>
              <p className="text-sm text-gray-500 mb-4">
                Monitors {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} across web and news, then synthesizes strategic insights.
              </p>
              <GenerateButton />
            </div>

            {latestBriefing && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Latest Briefing</h2>
                  <Link href={`/briefings/${latestBriefing.id}`} className="text-sm text-violet-600 hover:underline">
                    View full →
                  </Link>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {new Date(latestBriefing.generated_at).toLocaleDateString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{latestBriefing.executive_summary}</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tracked</h2>
                <Link href="/competitors" className="text-xs text-violet-600 hover:underline">Manage</Link>
              </div>
              <ul className="space-y-3">
                {competitors.map(c => (
                  <li key={c.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.website_url}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
