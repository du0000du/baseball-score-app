import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from './_components/Nav'
import PageWrapper from './_components/PageWrapper'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-night-950">
      <Nav />
      {/* モバイル: px-4 / デスクトップ: サイドバー60分 + 両端に余裕ある余白 */}
      <main className="lg:pl-60 px-4 lg:px-10 py-6 lg:py-8">
        <div className="max-w-5xl mx-auto">
          <PageWrapper>{children}</PageWrapper>
        </div>
      </main>
    </div>
  )
}
