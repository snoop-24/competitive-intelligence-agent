import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return existing workspace or create one
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!workspace) {
    const companyName = user.user_metadata?.company_name ?? 'My Company'
    const { data: created, error } = await supabase
      .from('workspaces')
      .insert({ name: companyName, owner_id: user.id })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    workspace = created
  }

  return NextResponse.json({ workspace })
}
