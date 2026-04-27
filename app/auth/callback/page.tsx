'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    const errorDescription = params.get('error_description')

    if (errorParam) {
      router.replace(
        `/login?error=${encodeURIComponent(errorDescription ?? errorParam)}`
      )
      return
    }

    // Implicit flow: Supabase SDK automatically parses the hash fragment
    // and fires onAuthStateChange when session is set.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()
          clearTimeout(timeout)
          const next = params.get('next') ?? '/dashboard'
          router.replace(next)
        }
      }
    )

    // Also check immediately in case session is already set
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        const next = params.get('next') ?? '/dashboard'
        router.replace(next)
      }
    })

    // Timeout fallback (10 seconds)
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      router.replace(
        '/login?error=' + encodeURIComponent('ログインがタイムアウトしました。もう一度お試しください。')
      )
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <div className="min-h-screen bg-navy-800 flex items-center justify-center">
      <div className="text-white text-lg animate-pulse">ログイン中...</div>
    </div>
  )
}
