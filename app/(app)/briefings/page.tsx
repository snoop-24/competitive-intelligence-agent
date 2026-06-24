import { createServerClient } from '@/lib/supabase/server'
import type { Briefing } from '@/lib/supabase/types'
import Link from 'next/link'

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
        .order('generated_at', { ascending: false })).data ?? []
    : []

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Briefings</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      </div>
      {briefings.length === 0 ? (
        <p className="text-gray-500 text-sm">No briefings yet. Generate one from the dashboard.</p>
      ) : (
        <ul className="space-y-3">
          {briefings.map(b => (
            <li key={b.id}>
              <Link href={`/briefings/${b.id}`}
                className="block bg-white border rounded-xl p-5 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    {new Date(b.generated_at).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === 'complete' ? 'bg-green-100 text-green-700' :
                    b.status === 'generating' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{b.status}</span>
                </div>
                {b.executive_summary && (
                  <p className="text-sm text-gray-600 line-clamp-2">{b.executive_summary}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
