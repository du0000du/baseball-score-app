'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { RESULT_TYPE_LABELS, DIRECTION_LABELS } from '@/lib/supabase/types'
import type { AtBat, Direction, Game, ResultType } from '@/lib/supabase/types'

// 打球方向を表示するかどうか（三振・四球・死球・犠打は方向なし）
const SHOW_DIRECTION: ResultType[] = [
  'hit', 'double', 'triple', 'hr',
  'groundout', 'flyout', 'sac_fly', 'error', 'fc',
]

const RESULT_GROUPS: { label: string; color: string; activeColor: string; cols: string; items: ResultType[] }[] = [
  {
    label: '安打',
    color: 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100',
    activeColor: 'bg-green-600 border-green-600 text-white',
    cols: 'grid-cols-4',
    items: ['hit', 'double', 'triple', 'hr'],
  },
  {
    label: 'アウト',
    color: 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100',
    activeColor: 'bg-gray-600 border-gray-600 text-white',
    cols: 'grid-cols-3',
    items: ['strikeout', 'groundout', 'flyout'],
  },
  {
    label: '出塁',
    color: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
    activeColor: 'bg-blue-600 border-blue-600 text-white',
    cols: 'grid-cols-2',
    items: ['walk', 'hbp'],
  },
  {
    label: 'その他',
    color: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
    activeColor: 'bg-purple-600 border-purple-600 text-white',
    cols: 'grid-cols-4',
    items: ['sac_bunt', 'sac_fly', 'error', 'fc'],
  },
]

const RESULT_SHORT: Record<ResultType, string> = {
  hit: '単打', double: '二塁打', triple: '三塁打', hr: '本塁打',
  strikeout: '三振', groundout: '内野ゴロ', flyout: '外野フライ',
  walk: '四球', hbp: '死球',
  sac_bunt: '犠打', sac_fly: '犠飛', error: 'エラー', fc: 'FC',
}

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'left', label: 'レフト' },
  { value: 'left_center', label: '左中間' },
  { value: 'center', label: 'センター' },
  { value: 'right_center', label: '右中間' },
  { value: 'right', label: 'ライト' },
]

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function ResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win') return <span className="text-green-600 font-bold">勝</span>
  if (result === 'loss') return <span className="text-red-600 font-bold">負</span>
  return <span className="text-yellow-600 font-bold">分</span>
}

export default function AtBatsPage() {
  const params = useParams()
  const gameId = params.id as string
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [game, setGame] = useState<Game | null>(null)
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')

  // フォーム状態
  const [battingOrder, setBattingOrder] = useState<number | null>(null)
  const [resultType, setResultType] = useState<ResultType | null>(null)
  const [direction, setDirection] = useState<Direction | null>(null)
  const [isRbi, setIsRbi] = useState(false)
  const [isRun, setIsRun] = useState(false)
  const [isStolenBase, setIsStolenBase] = useState(false)

  const fetchData = useCallback(async () => {
    const [{ data: gameData }, { data: atBatsData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('at_bats').select('*').eq('game_id', gameId).order('at_bat_number'),
    ])
    setGame(gameData)
    setAtBats(atBatsData ?? [])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const resetForm = () => {
    setResultType(null)
    setDirection(null)
    setIsRbi(false)
    setIsRun(false)
    setIsStolenBase(false)
  }

  const handleSubmit = async () => {
    if (!battingOrder) {
      setSubmitError('打順を選択してください')
      return
    }
    if (!resultType) {
      setSubmitError('結果を選択してください')
      return
    }
    setSubmitError('')
    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const hitType =
      resultType === 'hit' ? 'single'
      : resultType === 'double' ? 'double'
      : resultType === 'triple' ? 'triple'
      : resultType === 'hr' ? 'hr'
      : null

    const showDir = SHOW_DIRECTION.includes(resultType)

    const { error } = await supabase.from('at_bats').insert({
      game_id: gameId,
      user_id: user.id,
      at_bat_number: atBats.length + 1,
      batting_order: battingOrder,
      result_type: resultType,
      hit_type: hitType,
      direction: showDir ? direction : null,
      is_rbi: isRbi,
      is_run: isRun,
      is_stolen_base: isStolenBase,
      is_caught_stealing: false,
      is_error: resultType === 'error',
      input_method: 'manual',
    })

    if (error) {
      setSubmitError('登録に失敗しました: ' + error.message)
      setSubmitting(false)
      return
    }

    resetForm()
    setSubmitting(false)
    fetchData()
  }

  const handleDeleteAtBat = async (id: string) => {
    setDeletingId(id)
    await supabase.from('at_bats').delete().eq('id', id)
    setDeletingId(null)
    fetchData()
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">試合が見つかりません</p>
        <Link href="/games" className="text-navy-500 hover:underline mt-2 block">試合一覧へ</Link>
      </div>
    )
  }

  const showDirection = resultType ? SHOW_DIRECTION.includes(resultType) : false

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/games" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
          ← 試合一覧
        </Link>
      </div>

      <div className="bg-navy-500 text-white rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-blue-200">{formatDate(game.game_date)}</div>
            <div className="text-xl font-bold mt-0.5">vs {game.opponent}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {game.score_us} - {game.score_them}
            </div>
            <div className="text-sm mt-0.5">
              <ResultBadge result={game.result} />
            </div>
          </div>
        </div>
        <div className="mt-2 text-sm text-blue-200">
          {atBats.length}打席記録済み
        </div>
      </div>

      {/* 打席入力フォーム */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
        <h2 className="font-semibold text-gray-700">打席を追加</h2>

        {submitError && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{submitError}</div>
        )}

        {/* 打順 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            打順 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-9 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBattingOrder(n)}
                className={`py-3 rounded-lg text-sm font-bold border-2 transition-all ${
                  battingOrder === n
                    ? 'bg-navy-500 border-navy-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-navy-100 hover:bg-navy-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 結果 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            結果 <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {RESULT_GROUPS.map((group) => (
              <div key={group.label} className={`grid ${group.cols} gap-1.5`}>
                {group.items.map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => {
                      setResultType(rt)
                      if (!SHOW_DIRECTION.includes(rt)) setDirection(null)
                    }}
                    className={`py-3 rounded-lg border text-sm font-medium transition-all ${
                      resultType === rt ? group.activeColor : group.color
                    }`}
                  >
                    {RESULT_SHORT[rt]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* 打球方向（任意） */}
        {showDirection && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              打球方向
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  type="button"
                  onClick={() => setDirection(direction === dir.value ? null : dir.value)}
                  className={`py-3 rounded-lg border text-xs font-medium transition-all ${
                    direction === dir.value
                      ? 'bg-field-500 border-field-500 text-white'
                      : 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 付加情報 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">付加情報</label>
          <div className="flex gap-4">
            {[
              { key: 'rbi', label: '打点', state: isRbi, set: setIsRbi },
              { key: 'run', label: '得点', state: isRun, set: setIsRun },
              { key: 'sb', label: '盗塁', state: isStolenBase, set: setIsStolenBase },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => item.set(!item.state)}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                    item.state
                      ? 'bg-navy-500 border-navy-500 text-white'
                      : 'border-gray-300 hover:border-navy-400'
                  }`}
                >
                  {item.state && (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !battingOrder || !resultType}
          className="w-full bg-navy-500 hover:bg-navy-600 text-white py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40"
        >
          {submitting ? '登録中...' : '打席を記録する'}
        </button>
      </div>

      {/* 打席一覧 */}
      {atBats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">打席記録</h2>
          <div className="space-y-2">
            {atBats.map((ab) => (
              <div
                key={ab.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-8">#{ab.at_bat_number}</span>
                  <span className="text-xs bg-navy-100 text-navy-600 px-1.5 py-0.5 rounded font-medium">
                    {ab.batting_order}番
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    {RESULT_TYPE_LABELS[ab.result_type as ResultType] ?? ab.result_type}
                  </span>
                  {ab.direction && (
                    <span className="text-xs text-gray-500">
                      → {DIRECTION_LABELS[ab.direction as Direction]}
                    </span>
                  )}
                  <div className="flex gap-1">
                    {ab.is_rbi && <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">打点</span>}
                    {ab.is_run && <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">得点</span>}
                    {ab.is_stolen_base && <span className="text-xs bg-green-100 text-green-600 px-1 rounded">盗塁</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAtBat(ab.id)}
                  disabled={deletingId === ab.id}
                  className="text-red-400 hover:text-red-600 transition-colors text-xs disabled:opacity-50 ml-2"
                >
                  削除
                </button>
              </div>
            ))}
