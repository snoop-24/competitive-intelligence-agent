import { createServerClient } from '@/lib/supabase/server'
import { AddCompetitorForm } from '@/components/AddCompetitorForm'
import { CompetitorList } from '@/components/CompetitorList'
import type { Competitor } from '@/lib/supabase/types'

export default async function CompetitorsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('owner_id', user!.id).single()

  const competitors: Competitor[] = workspace
    ? (await supabase.from('competitors').select('*').eq('workspace_id', workspace.id).order('created_at')).data ?? []
    : []

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 700, fontSize: 22, letterSpacing: '-0.4px', color: 'var(--text)', marginBottom: 4 }}>
          Competitors
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AddCompetitorForm />
        <CompetitorList competitors={competitors} />
      </div>
    </div>
  )
}
