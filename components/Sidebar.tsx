'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/competitors',
    label: 'Competitors',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    href: '/briefings',
    label: 'Briefings',
    icon: (
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
]

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const initials = email.slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div
      className="fixed left-0 top-0 bottom-0 flex flex-col items-center py-4 z-10"
      style={{ width: 60, background: 'var(--bg-deep)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div
        className="w-8 h-8 flex items-center justify-center mb-6 flex-shrink-0"
        style={{ borderRadius: 7, background: 'linear-gradient(135deg, #00D4AA, #0EA5E9)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.6" />
          <circle cx="8" cy="8" r="3.5" stroke="white" strokeWidth="1.2" strokeOpacity="0.8" />
          <circle cx="8" cy="8" r="1.5" fill="white" />
        </svg>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {NAV_LINKS.map(link => {
          const active = pathname === link.href || pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className="w-10 h-10 flex items-center justify-center transition-all"
              style={{
                borderRadius: 8,
                background: active ? 'rgba(0,212,170,0.1)' : 'transparent',
                border: active ? '1px solid rgba(0,212,170,0.2)' : '1px solid transparent',
                color: active ? 'var(--accent)' : 'var(--dim)',
              }}
            >
              {link.icon}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="w-10 h-10 flex items-center justify-center transition-all"
          style={{ borderRadius: 8, color: 'var(--dim)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--alert)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--dim)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>

        <div
          className="w-8 h-8 flex items-center justify-center flex-shrink-0"
          title={email}
          style={{ borderRadius: '50%', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', fontFamily: 'var(--font-space-grotesk)', fontSize: 10, fontWeight: 600, color: 'white' }}
        >
          {initials}
        </div>
      </div>
    </div>
  )
}
