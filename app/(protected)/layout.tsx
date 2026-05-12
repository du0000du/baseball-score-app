import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from './_components/Nav'
import PageWrapper from './_components/PageWrapper'
import OfflineBanner from './_components/OfflineBanner'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-lv2">
      <OfflineBanner />
      <Nav />
      {/* R-1: モバイル下部固定ナビ分の余白を確保（lg 以上は不要） */}
      <main className="lg:pl-60 px-4 py-6 pb-20 lg:pb-6">
        <div className="max-w-5xl mx-auto">
          <PageWrapper>{children}</PageWrapper>
        </div>
      </main>
    </div>
  )
}
