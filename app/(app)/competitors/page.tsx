import { createServerClient } from '@/lib/supabase/server'
import { AddCompetitorForm } from '@/components/AddCompetitorForm'
import { CompetitorList } from '@/components/CompetitorList'
import type { Competitor } from '@/lib/supabase/types'
import Link from 'next/link'

export default async function CompetitorsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user!.id)
    .single()

  const competitors: Competitor[] = workspace
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id).order('created_at')).data ?? []
    : []

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Competitors</h1>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      </div>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Add Competitor</h2>
        <AddCompetitorForm />
      </section>
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
          Tracking {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
        </h2>
        <CompetitorList competitors={competitors} />
      </section>
    </div>
  )
}
