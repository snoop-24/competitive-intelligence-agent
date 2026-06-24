import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ briefings: [] })

  const { data: briefings } = await supabase
    .from('briefings')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('generated_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ briefings: briefings ?? [] })
}
