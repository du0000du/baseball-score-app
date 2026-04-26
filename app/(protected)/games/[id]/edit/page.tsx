import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditGameForm from './_EditGameForm'

interface Props {
  params: { id: string }
}

export default async function EditGamePage({ params }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!game) notFound()

  return <EditGameForm game={game} />
}
