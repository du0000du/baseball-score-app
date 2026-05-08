'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function GoogleSvg() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setAuthError(decodeURIComponent(error))
    }
  }, [searchParams])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setAuthError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setAuthError(error.message)
      setLoading(false)
    }
    // On success the browser navigates away — no need to reset loading
  }

  return (
    <div className="bg-lv1 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
      <h2 className="text-xl font-semibold text-main mb-2 text-center">ログイン</h2>
      <p className="text-sub2 text-sm text-center mb-6">
        Googleアカウントでサインイン
      </p>

      {authError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
          ログインに失敗しました。もう一度お試しください。
          <div className="text-xs text-red-400 mt-1 break-all">{authError}</div>
        </div>
      )}

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-s2 hover:border-theme hover:bg-lv2 text-main font-medium py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <GoogleSvg />
        {loading ? 'リダイレクト中...' : 'Googleでログイン'}
      </button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-theme flex flex-col items-center justify-center px-4">
      <div className="text-center mb-10">
        <div className="text-8xl mb-6">⚾</div>
        <h1 className="text-4xl font-bold text-white mb-3">草野球記録</h1>
        <p className="text-white/70 text-sm">あなたの打席を記録しよう</p>
      </div>
      <Suspense fallback={<div className="animate-pulse text-white text-sm">読み込み中...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
