import { createServerClient } from '@/lib/supabase/server'
import { AddCompetitorForm } from '@/components/AddCompetitorForm'
import { CompetitorList } from '@/components/CompetitorList'
import type { Competitor } from '@/lib/supabase/types'

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
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Competitors</h1>
        <p className="text-sm text-slate-500 mt-1">
          {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked
        </p>
      </div>
      <AddCompetitorForm />
      <CompetitorList competitors={competitors} />
    </div>
  )
}
