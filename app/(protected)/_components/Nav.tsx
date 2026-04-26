'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const linkClass = (path: string) =>
    `text-sm font-medium px-3 py-1 rounded transition-colors ${
      pathname === path || (path !== '/dashboard' && pathname.startsWith(path))
        ? 'bg-white/20 text-white'
        : 'text-blue-100 hover:text-white hover:bg-white/10'
    }`

  return (
    <nav className="bg-navy-500 shadow-lg">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-white font-bold text-lg mr-3">⚾</span>
          <Link href="/dashboard" className={linkClass('/dashboard')}>
            ダッシュボード
          </Link>
          <Link href="/games" className={linkClass('/games')}>
            試合
          </Link>
          <Link href="/stats" className={linkClass('/stats')}>
            成績
          </Link>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-blue-100 hover:text-white transition-colors"
        >
          ログアウト
        </button>
      </div>
    </nav>
  )
}
