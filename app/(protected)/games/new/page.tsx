'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SuggestInput from '@/app/(protected)/_components/SuggestInput'
import { DateScrollPicker } from '../_components/DateScrollPicker'

const INPUT  = 'w-full border border-s2 rounded-lg px-3 py-2 text-base bg-lv1 text-main placeholder-sub2 focus:outline-none focus:ring-2 focus:ring-theme'
const LABEL  = 'block text-sm font-medium text-main mb-1'
const LABEL2 = 'block text-sm font-medium text-main mb-2'

export default function NewGamePage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [pastOpponents, setPastOpponents] = useState<string[]>([])
  const [pastStadiums, setPastStadiums] = useState<string[]>([])

  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    game_date: today,
    opponent: '',
    result: 'win' as 'win' | 'loss' | 'draw',
    score_us: '0',
    score_them: '0',
    stadium: '',
    notes: '',
  })

  // 過去の対戦相手・球場を候補として取得
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('games')
        .select('opponent, stadium')
        .eq('user_id', user.id)
      if (data) {
        const opponents = Array.from(new Set(data.map((g) => g.opponent).filter(Boolean))) as string[]
        const stadiums  = Array.from(new Set(data.map((g) => g.stadium).filter(Boolean))) as string[]
        setPastOpponents(opponents.sort())
        setPastStadiums(stadiums.sort())
      }
    }
    fetchSuggestions()
  }, [supabase])

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.opponent.trim()) { setError('対戦相手を入力してください'); return }
    if (form.opponent.trim().length > 100) { setError('対戦相手は100字以内で入力してください'); return }
    if (form.stadium.trim().length > 100) { setError('球場名は100字以内で入力してください'); return }
    if (form.notes.length > 2000) { setError('メモは2000字以内で入力してください'); return }
    const scoreUs = parseInt(form.score_us, 10)
    const scoreThem = parseInt(form.score_them, 10)
    if (isNaN(scoreUs) || scoreUs < 0 || scoreUs > 99) { setError('自チームのスコアは0〜99で入力してください'); return }
    if (isNaN(scoreThem) || scoreThem < 0 || scoreThem > 99) { setError('相手チームのスコアは0〜99で入力してください'); return }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const season = new Date(form.game_date).getFullYear()
    const { data: newGame, error: dbError } = await supabase.from('games').insert({
      user_id: user.id,
      game_date: form.game_date,
      opponent: form.opponent.trim(),
      result: form.result,
      score_us: scoreUs,
      score_them: scoreThem,
      stadium: form.stadium.trim() || null,
      notes: form.notes.trim() || null,
      season,
    }).select().single()

    if (dbError) { setError('登録に失敗しました。もう一度お試しください。'); setLoading(false); return }
    router.push(`/games/${newGame.id}/at-bats`)
  }

  const resultOptions = [
    { value: 'win',  label: '勝利 ○',
      active: 'bg-pos border-pos-t text-pos-t',
    },
    { value: 'loss', label: '敗北 ●',
      active: 'bg-neg border-neg-t text-neg-t',
    },
    { value: 'draw', label: '引分 △',
      active: 'bg-neu border-neu-t text-neu-t',
    },
  ] as const

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/games" className="text-sub2 hover:text-main transition-colors">
          ← 試合一覧
        </Link>
        <h1 className="text-2xl font-bold text-accent">試合を登録</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-lv1 rounded-xl shadow-sm border border-s2 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">{error}</div>
        )}

        <div>
          <label className={LABEL}>試合日 *</label>
          <DateScrollPicker value={form.game_date} onChange={(v) => set('game_date', v)} />
        </div>

        <div>
          <label className={LABEL}>対戦相手 *</label>
          <SuggestInput
            value={form.opponent}
            onChange={(v) => set('opponent', v)}
            suggestions={pastOpponents}
            placeholder="例：○○ファイターズ"
            title="対戦相手の選択"
            required
            className={INPUT}
          />
        </div>

        <div>
          <label className={LABEL2}>試合結果 *</label>
          <div className="grid grid-cols-3 gap-2">
            {resultOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('result', opt.value)}
                className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  form.result === opt.value
                    ? opt.active
                    : 'border-s2 text-sub2 hover:border-s1'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL2}>スコア</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-sub2 mb-1 block">自チーム</label>
              <input type="number" min="0" inputMode="numeric" enterKeyHint="next" value={form.score_us} onChange={(e) => set('score_us', e.target.value)}
                className={`${INPUT} text-center text-lg font-bold`} />
            </div>
            <span className="text-sub2 font-bold mt-5">-</span>
            <div className="flex-1">
              <label className="text-xs text-sub2 mb-1 block">相手チーム</label>
              <input type="number" min="0" inputMode="numeric" enterKeyHint="done" value={form.score_them} onChange={(e) => set('score_them', e.target.value)}
                className={`${INPUT} text-center text-lg font-bold`} />
            </div>
          </div>
        </div>

        <div>
          <label className={LABEL}>球場・グラウンド</label>
          <SuggestInput
            value={form.stadium}
            onChange={(v) => set('stadium', v)}
            suggestions={pastStadiums}
            placeholder="例：○○公園野球場"
            title="球場の選択"
            className={INPUT}
          />
        </div>

        <div>
          <label className={LABEL}>メモ</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
            placeholder="試合の感想など"
            className={`${INPUT} resize-none`} />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-theme hover:opacity-90 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50">
          {loading ? '登録中...' : '試合を登録する'}
        </button>
      </form>
    </div>
  )
}
