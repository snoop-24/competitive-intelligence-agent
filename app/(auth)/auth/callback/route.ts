import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createServerClient()
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch (e) {
      console.error('Auth code exchange failed:', e)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
