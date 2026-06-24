import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { sendBriefingEmail } from '@/lib/email'
import type { BriefingItem, Competitor, Briefing } from '@/lib/supabase/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: briefing } = await supabase
    .from('briefings').select('*').eq('id', id).single()
  if (!briefing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: items } = await supabase
    .from('briefing_items').select('*').eq('briefing_id', id)

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('owner_id', user.id).single()

  const { data: competitors } = workspace
    ? await supabase.from('competitors').select('*').eq('workspace_id', workspace.id)
    : { data: [] }

  await sendBriefingEmail({
    to: user.email,
    briefing: briefing as Briefing,
    items: (items ?? []) as BriefingItem[],
    competitors: (competitors ?? []) as Competitor[],
  })

  return NextResponse.redirect(
    new URL(`/briefings/${id}?emailed=true`, _request.url)
  )
}
