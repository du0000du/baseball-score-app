import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase 無料プランの自動停止（約1週間無アクセスで停止）を防ぐための軽いアクセス。
// Vercel Cron（vercel.json）から毎日呼ばれる。RLS により匿名では行は返らないが、
// PostgREST → DB へのリクエスト自体が発生するため「使用中」として扱われる。
// データは一切返さない。
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
  const { error } = await supabase.from('games').select('id', { head: true, count: 'exact' }).limit(1)
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 })
}
