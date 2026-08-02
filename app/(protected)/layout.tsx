import { redirect } from 'next/navigation'
import { getCachedUser } from '@/lib/supabase/server'
import Nav from './_components/Nav'
import PageWrapper from './_components/PageWrapper'
import OfflineBanner from './_components/OfflineBanner'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // PERF-8: page 側と同じリクエスト内で getUser を共有（往復1回に集約）
  const user = await getCachedUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-lv2">
      <OfflineBanner />
      <Nav />
      {/* R-1: モバイル下部固定ナビ分の余白を確保（lg 以上は不要）
          R-7: PWA standalone モードでは下部ナビが safe-area-inset-bottom 分さらに
          下に余白を持つため、main の paddingBottom も同分を合算しコンテンツ被りを防ぐ。
          Tailwind arbitrary value で lg: 以上では pb-6 に切り替え、デスクトップに
          過剰な余白を生まないようレスポンシブ対応。 */}
      <main className="lg:pl-60 px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6">
        <div className="max-w-5xl mx-auto">
          <PageWrapper>{children}</PageWrapper>
        </div>
      </main>
    </div>
  )
}
