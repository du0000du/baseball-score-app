'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  useEffect(() => {
    const handleCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search)

      // 1. Check for OAuth errors returned in query string
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      if (errorParam) {
        window.location.href =
          '/login?error=' + encodeURIComponent(errorDescription ?? errorParam)
        return
      }

      const supabase = createClient()
      const next = searchParams.get('next') ?? '/dashboard'

      // 2. PKCE flow: Supabase returns ?code= in the query string
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          window.location.href = next
        } else {
          window.location.href =
            '/login?error=' + encodeURIComponent(error.message)
        }
        return
      }

      // 3. No code found — something went wrong
      window.location.href =
        '/login?error=' + encodeURIComponent('ログイン情報が取得できませんでした。もう一度お試しください。')
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-theme flex items-center justify-center">
      <div className="text-white text-lg animate-pulse">ログイン中...</div>
    </div>
  )
}
