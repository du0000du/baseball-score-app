'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Game, PitchingStat, PitchingResult } from '@/lib/supabase/types'
import { formatIP } from '@/lib/stats'

const SELECT = 'border border-gray-200 dark:border-night-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-night-750 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crimson-500 dark:focus:ring-crimson-400'

const RESULT_OPTIONS: { value: PitchingResult; label: string }[] = [
  { value: 'none', label: 'なし' },
  { value: 'win', label: '勝利' },
  { value: 'loss', label: '敗戦' },
  { value: 'save', label: 'セーブ' },
  { value: 'hold', label: 'ホールド' },
]

export default function PitchingPage() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.id as string
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [inningsWhole, setInningsWhole] = useState(0)
  const [inningsThirds, setInningsThirds] = useState(0)
  const [result, setResult] = useState<PitchingResult>('none')
  const [hitsAllowed, setHitsAllowed] = useState(0)
  const [homeRunsAllowed, setHomeRunsAllowed] = useState(0)
  const [strikeouts, setStrikeouts] = useState(0)
  const [walksGiven, setWalksGiven] = useState(0)
  const [hitBatsmen, setHitBatsmen] = useState(0)
  const [runsAllowed, setRunsAllowed] = useState(0)
  const [earnedRuns, setEarnedRuns] = useState(0)
  const [completeGame, setCompleteGame] = useState(false)
  const [pitchCount, setPitchCount] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: g } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single()
      if (g) setGame(g as Game)

      const { data: ps } = await supabase
        .from('pitching_stats')
        .select('*')
        .eq('game_id', gameId)
        .maybeSingle()
      if (ps) {
        const p = ps as PitchingStat
        setInningsWhole(Math.floor(p.innings_pitched / 3))
        setInningsThirds(p.innings_pitched % 3)
        setResult(p.result)
        setHitsAllowed(p.hits_allowed)
        setHomeRunsAllowed(p.home_runs_allowed)
        setStrikeouts(p.strikeouts)
        setWalksGiven(p.walks)
        setHitBatsmen(p.hit_batsmen)
        setRunsAllowed(p.runs_allowed)
        setEarnedRuns(p.earned_runs)
        setCompleteGame(p.complete_game)
        setPitchCount(p.pitch_count !== null ? String(p.pitch_count) : '')
      }
      setLoading(false)
    }
    load()
  }, [supabase, gameId])

  const innings_pitched = inningsWhole * 3 + inningsThirds

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      game_id: gameId,
      user_id: user.id,
      innings_pitched,
      result,
      hits_allowed: hitsAllowed,
      home_runs_allowed: homeRunsAllowed,
      strikeouts,
      walks: walksGiven,
      hit_batsmen: hitBatsmen,
      runs_allowed: runsAllowed,
      earned_runs: earnedRuns,
      complete_game: completeGame,
      pitch_count: pitchCount !== '' ? parseInt(pitchCount) : null,
    }

    const { error: err } = await supabase
      .from('pitching_stats')
      .upsert(payload, { onConflict: 'game_id,user_id' })

    if (err) {
      setError('保存に失敗しました: ' + err.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="min-h-[520px] flex items-center justify-center text-gray-400 dark:text-night-400">読み込み中...</div>
  }

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-')
    return `${y}年${parseInt(m)}月${parseInt(d)}日`
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-400 dark:text-night-400 hover:text-gray-600 dark:hover:text-night-200 mb-2 flex items-center gap-1 transition-colors"
        >
          ← 戻る
        </button>
        <h1 className="text-2xl font-bold text-crimson-500 dark:text-crimson-400">投手成績入力</h1>
        {game && (
          <p className="text-sm text-gray-500 dark:text-night-300 mt-1">
            {formatDate(game.game_date)} vs {game.opponent}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 p-6 space-y-5">

        {/* 投球回 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-night-200 mb-2">投球回</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <select
                value={inningsWhole}
                onChange={(e) => setInningsWhole(parseInt(e.target.value))}
                className={SELECT}
              >
                {Array.from({ length: 13 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600 dark:text-night-300">回</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={inningsThirds}
                onChange={(e) => setInningsThirds(parseInt(e.target.value))}
                className={SELECT}
              >
                <option value={0}>0/3</option>
                <option value={1}>1/3</option>
                <option value={2}>2/3</option>
              </select>
            </div>
            <span className="text-sm text-gray-400 dark:text-night-400">= {formatIP(innings_pitched)}回</span>
          </div>
        </div>

        {/* 勝敗セーブ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-night-200 mb-2">登板結果</label>
          <div className="flex gap-2 flex-wrap">
            {RESULT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setResult(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  result === opt.value
                    ? 'bg-crimson-500 dark:bg-crimson-600 text-white'
                    : 'bg-gray-100 dark:bg-night-750 text-gray-600 dark:text-night-300 hover:bg-gray-200 dark:hover:bg-night-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 数値入力グリッド */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '被安打', value: hitsAllowed, setter: setHitsAllowed },
            { label: '被本塁打', value: homeRunsAllowed, setter: setHomeRunsAllowed },
            { label: '奪三振', value: strikeouts, setter: setStrikeouts },
            { label: '与四球', value: walksGiven, setter: setWalksGiven },
            { label: '与死球', value: hitBatsmen, setter: setHitBatsmen },
            { label: '失点', value: runsAllowed, setter: setRunsAllowed },
            { label: '自責点', value: earnedRuns, setter: setEarnedRuns },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-gray-500 dark:text-night-400 mb-1">{label}</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setter(Math.max(0, value - 1))}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-night-750 hover:bg-gray-200 dark:hover:bg-night-700 text-gray-600 dark:text-night-300 font-bold text-lg flex items-center justify-center transition-colors border border-transparent dark:border-night-600"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-gray-800 dark:text-white">{value}</span>
                <button
                  onClick={() => setter(value + 1)}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-night-750 hover:bg-gray-200 dark:hover:bg-night-700 text-gray-600 dark:text-night-300 font-bold text-lg flex items-center justify-center transition-colors border border-transparent dark:border-night-600"
                >
                  ＋
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 完投 */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={completeGame}
              onChange={(e) => setCompleteGame(e.target.checked)}
              className="w-4 h-4 rounded accent-crimson-500"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-night-200">完投</span>
          </label>
        </div>

        {/* 投球数（任意） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-night-200 mb-1.5">
            投球数 <span className="text-gray-400 font-normal text-xs">（任意）</span>
          </label>
          <input
            type="number"
            value={pitchCount}
            onChange={(e) => setPitchCount(e.target.value)}
            placeholder="例: 85"
            min={0}
            className="w-32 border border-gray-200 dark:border-night-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-night-750 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-night-400 focus:outline-none focus:ring-2 focus:ring-crimson-500 dark:focus:ring-crimson-400"
          />
        </div>

        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        {saved  && <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ 保存しました</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-crimson-500 hover:bg-crimson-600 dark:bg-crimson-600 dark:hover:bg-crimson-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}
 