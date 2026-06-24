import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div>
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-blue-700">IntelAgent</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
          <Link href="/competitors" className="text-gray-600 hover:text-gray-900">Competitors</Link>
          <Link href="/briefings" className="text-gray-600 hover:text-gray-900">Briefings</Link>
          <span className="text-gray-400 text-xs">{user.email}</span>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
