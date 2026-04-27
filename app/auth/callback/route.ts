import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (errorParam) {
    console.error('[auth/callback] OAuth error:', errorParam, errorDescription)
    const redirectUrl = getBaseUrl(request)
    return NextResponse.redirect(
      `${redirectUrl}/login?error=${encodeURIComponent(errorDescription ?? errorParam)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirectUrl = getBaseUrl(request)
      return NextResponse.redirect(`${redirectUrl}${next}`)
    } else {
      console.error('[auth/callback] exchangeCodeForSession error:', error.message)
      const redirectUrl = getBaseUrl(request)
      return NextResponse.redirect(
        `${redirectUrl}/login?error=${encodeURIComponent(error.message)}`
      )
    }
  }
  const redirectUrl = getBaseUrl(request)
  return NextResponse.redirect(`${redirectUrl}/login?error=auth_callback_error`)
}

function getBaseUrl(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`
  const { origin } = new URL(request.url)
  return origin
}
