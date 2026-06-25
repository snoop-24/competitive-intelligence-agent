import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { discoverCompanyWebsite } from '@/lib/discovery'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ competitors: [] })

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ competitors: competitors ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description } = await request.json()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: 'No workspace found' }, { status: 404 })

  const website_url = await discoverCompanyWebsite(name)

  const { data: competitor, error } = await supabase
    .from('competitors')
    .insert({ workspace_id: workspace.id, name, website_url, description: description ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ competitor }, { status: 201 })
}
