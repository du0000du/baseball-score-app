'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  useEffect(() => {
    const handleCallback = async () => {
      // 1. Check for OAuth error from Supabase (query params)
      const searchParams = new URLSearchParams(window.location.search)
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      if (errorParam) {
        window.location.href =
          '/login?error=' + encodeURIComponent(errorDescription ?? errorParam)
        return
      }

      // 2. With implicit flow, tokens come in the URL hash fragment
      const hash = window.location.hash.substring(1) // strip '#'
      const hashParams = new URLSearchParams(hash)
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (!accessToken || !refreshToken) {
        window.location.href =
          '/login?error=' + encodeURIComponent('ログイン情報が取得できませんでした。もう一度お試しください。')
        return
      }

      // 3. Explicitly set the session using the tokens
      const supabase = createClient()
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (data.session) {
        // 4. Hard redirect — ensures cookies are included in the next request
        const next = searchParams.get('next') ?? '/dashboard'
        window.location.href = next
      } else {
        window.location.href =
          '/login?error=' + encodeURIComponent(error?.message ?? 'セッションの設定に失敗しました')
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center">
      <div className="text-white text-lg animate-pulse">ログイン中...</div>
    </div>
  )
}
