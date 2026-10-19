import { redirect, notFound } from 'next/navigation'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import EditGameForm from './_EditGameForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditGamePage({ params }: Props) {
  const { id } = await params
  // PERF-8: layout でキャッシュ済みの user を再利用（往復ゼロ）
  const [supabase, user] = await Promise.all([createClient(), getCachedUser()])

  if (!user) redirect('/login')

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!game) notFound()

  // 前後ゲームナビ用
  const [{ data: prevGame }, { data: nextGame }] = await Promise.all([
    supabase.from('games')
      .select('id, game_date, opponent')
      .eq('user_id', user.id)
      .lt('game_date', game.game_date)
      .order('game_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('games')
      .select('id, game_date, opponent')
      .eq('user_id', user.id)
      .gt('game_date', game.game_date)
      .order('game_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <EditGameForm
      game={game}
      prevGame={prevGame ?? null}
      nextGame={nextGame ?? null}
    />
  )
}
