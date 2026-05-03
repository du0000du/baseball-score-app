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

  const navLinks = [
    { href: '/dashboard', label: 'ダッシュボード', icon: '🏠' },
    { href: '/games',     label: '試合',           icon: '⚾' },
    { href: '/stats',     label: '成績',           icon: '📊' },
  ]

  const mobileLinkClass = (href: string) =>
    isActive(href)
      ? 'bg-white/20 text-white'
      : 'text-crimson-100 dark:text-night-300 hover:text-white hover:bg-white/10'

  const sidebarLinkClass = (href: string) =>
    isActive(href)
      ? 'bg-crimson-500 dark:bg-crimson-600 text-white'
      : 'text-gray-600 dark:text-night-300 hover:bg-gray-100 dark:hover:bg-night-700 hover:text-gray-900 dark:hover:text-white'

  return (
    <>
      {/* モバイル: 上部ナビ */}
      <nav className="lg:hidden bg-crimson-700 dark:bg-night-900 shadow-lg border-b border-crimson-600 dark:border-night-600">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-white font-bold text-lg mr-3">⚾</span>
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium px-3 py-1.5 rounded-md transition-all duration-150 ${mobileLinkClass(href)}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className={`text-sm font-medium px-3 py-1.5 rounded-md transition-all duration-150 ${mobileLinkClass('/settings')}`}
            >
              設定
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-crimson-100 dark:text-night-400 hover:text-white transition-all duration-150"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      {/* デスクトップ: 左サイドバー */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 bg-crimson-700 dark:bg-night-900 border-r border-crimson-600 dark:border-night-600 shadow-xl z-10">
        <div className="px-6 py-5 border-b border-crimson-600 dark:border-night-700">
          <span className="text-white font-bold text-xl tracking-tight">⚾ 草野球記録</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98] ${sidebarLinkClass(href)}`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-crimson-600 dark:border-night-700 space-y-1">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98] ${sidebarLinkClass('/settings')}`}
          >
            <span className="text-base">⚙️</span>
            設定
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-crimson-200 dark:text-night-400 hover:bg-white/10 dark:hover:bg-night-700 hover:text-white transition-all duration-150"
          >
            <span className="text-base">🚪</span>
            ログアウト
          </button>
        </div>
      </aside>
    </>
  )
}
