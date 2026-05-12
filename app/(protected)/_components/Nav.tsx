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
    { href: '/settings',  label: '設定',           icon: '⚙️' },
  ]

  // R-1: モバイル下部固定タブ用の縦並びスタイル
  const mobileTabClass = (active: boolean) =>
    `flex flex-col items-center justify-center py-2 transition-colors ${
      active ? 'text-theme' : 'text-sub2 hover:text-main'
    }`

  const sidebarLinkClass = (href: string) =>
    isActive(href)
      ? 'bg-white/20 text-white dark:bg-theme/20 dark:text-theme'
      : 'text-white/70 hover:bg-white/10 hover:text-white dark:text-sub1 dark:hover:bg-lv2 dark:hover:text-main'

  return (
    <>
      {/* R-1: モバイル下部固定タブバー（5列均等：ダッシュボード/試合/成績/設定/ログアウト）
            R-7: PWA standalone モードで iOS の safe-area-inset を尊重して
            左右端ラベル切れ・ホームインジケータ被りを防ぐ。`max()` で通常 Safari でも
            最低 0.25rem (4px) のバッファを確保し、画面端ギリギリのタップ精度を改善。 */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-lv1 border-t border-s2 grid grid-cols-5"
        role="navigation"
        aria-label="モバイルナビゲーション"
        style={{
          paddingLeft: 'max(env(safe-area-inset-left), 0.25rem)',
          paddingRight: 'max(env(safe-area-inset-right), 0.25rem)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {navLinks.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={mobileTabClass(isActive(href))}
            aria-current={isActive(href) ? 'page' : undefined}
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="text-[10px] mt-0.5">{label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={handleSignOut}
          className={mobileTabClass(false)}
          aria-label="ログアウト"
        >
          <span className="text-lg leading-none">⏻</span>
          <span className="text-[10px] mt-0.5">ログアウト</span>
        </button>
      </nav>

      {/* デスクトップ: 左サイドバー */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 bg-theme dark:bg-lv2 border-r border-theme/30 dark:border-s2 shadow-xl z-10">
        <div className="px-6 py-5 border-b border-theme/30 dark:border-s2">
          <span className="text-white dark:text-theme font-bold text-xl tracking-tight">⚾ 草野球記録</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.slice(0, 3).map(({ href, label, icon }) => (
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

        <div className="px-3 py-4 border-t border-theme/30 dark:border-s2 space-y-1">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98] ${sidebarLinkClass('/settings')}`}
          >
            <span className="text-base">⚙️</span>
            設定
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 dark:text-sub1 hover:bg-white/10 dark:hover:bg-lv1 hover:text-white dark:hover:text-main transition-all duration-150"
          >
            <span className="text-base">🚪</span>
            ログアウト
          </button>
        </div>
      </aside>
    </>
  )
}
