'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (path: string) =>
    pathname === path || (path !== '/dashboard' && pathname.startsWith(path))

  return (
    <nav className="bg-navy-500 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-white font-bold text-lg mr-3">⚾</span>
          {[
            { href: '/dashboard', label: 'ダッシュボード' },
            { href: '/games',     label: '試合' },
            { href: '/stats',     label: '成績' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-all duration-150 ${
                isActive(href)
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:text-white hover:bg-white/10 active:bg-white/15 active:scale-[0.97]'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-all duration-150 ${
              isActive('/settings')
                ? 'bg-white/20 text-white'
                : 'text-blue-100 hover:text-white hover:bg-white/10 active:bg-white/15 active:scale-[0.97]'
            }`}
          >
            設定
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-blue-100 hover:text-white transition-all duration-150 active:opacity-70 active:scale-[0.97]"
          >
            ログアウト
          </button>
        </div>
      </div>
    </nav>
  )
}
