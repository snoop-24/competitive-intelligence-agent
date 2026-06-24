import { createServerClient } from '@/lib/supabase/server'
import { GenerateButton } from '@/components/GenerateButton'
import Link from 'next/link'
import type { Competitor, Briefing } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Auto-create workspace if first login
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

  // Seed demo competitors if workspace is new and has none
  if (workspace) {
    const { count } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)

    if (count === 0) {
      await supabase.from('competitors').insert([
        { workspace_id: workspace.id, name: 'Notion', website_url: 'https://notion.so/pricing', description: 'All-in-one workspace' },
        { workspace_id: workspace.id, name: 'Linear', website_url: 'https://linear.app/pricing', description: 'Issue tracking for software teams' },
        { workspace_id: workspace.id, name: 'Asana', website_url: 'https://asana.com/pricing', description: 'Project management platform' },
      ])
    }
  }

  const competitors: Competitor[] = workspace
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id)).data ?? []
    : []

  const latestBriefing: Briefing | null = workspace
    ? ((await supabase.from('briefings').select('*').eq('workspace_id', workspace.id)
        .eq('status', 'complete').order('generated_at', { ascending: false }).limit(1)).data?.[0] ?? null)
    : null

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Intelligence Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">{workspace?.name}</p>
        </div>
        <Link href="/competitors" className="text-sm bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
          Manage Competitors
        </Link>
      </div>

      <section className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Generate Competitive Briefing</h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitors {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} across web and news.
          </p>
        </div>
        {competitors.length === 0 ? (
          <p className="text-sm text-orange-500">
            Add competitors first. <Link href="/competitors" className="underline">Add now →</Link>
          </p>
        ) : (
          <GenerateButton />
        )}
      </section>

      {latestBriefing && (
        <section className="bg-white border rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Latest Briefing</h2>
            <Link href={`/briefings/${latestBriefing.id}`} className="text-sm text-blue-600 hover:underline">
              View full →
            </Link>
          </div>
          <p className="text-sm text-gray-400 mb-3">
            {new Date(latestBriefing.generated_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{latestBriefing.executive_summary}</p>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-gray-500 uppercase">Competitors Being Tracked</h2>
        </div>
        {competitors.length === 0 ? (
          <p className="text-sm text-gray-400">No competitors yet.</p>
        ) : (
          <ul className="space-y-2">
            {competitors.map(c => (
              <li key={c.id} className="flex items-center gap-3 bg-white border rounded-lg px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {c.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{c.website_url}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
