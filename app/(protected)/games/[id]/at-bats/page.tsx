'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  DIRECTION_LABELS,
  getAtBatLabel,
  FIELDING_POSITIONS,
} from '@/lib/supabase/types'
import type { AtBat, Direction, FieldingPosition, Game, ResultType, OutfieldDirection, InfieldPosition } from '@/lib/supabase/types'
import GameNavBar from '@/app/(protected)/_components/GameNavBar'
import type { NavGame } from '@/app/(protected)/_components/GameNavBar'

// 外野方向を表示する結果タイプ
const SHOW_OUTFIELD_DIRECTION: ResultType[] = [
  'hit', 'double', 'triple', 'hr',
  'flyout', 'sac_fly',
]

// 内野守備位置を表示する結果タイプ
const SHOW_INFIELD_POSITION: ResultType[] = ['groundout', 'infield_flyout']

// FC時に内野守備位置を表示
const SHOW_FC_POSITION: ResultType[] = ['fc']

// ライナーアウト時に守備位置を表示
const SHOW_LINER_POSITION: ResultType[] = ['liner_out']

// ライナー守備位置（内野5種 + 外野3種）
const LINER_POSITIONS: { value: Direction; label: string }[] = [
  { value: 'pitcher',     label: 'ピッチャーライナー' },
  { value: 'first_base',  label: 'ファーストライナー' },
  { value: 'second_base', label: 'セカンドライナー' },
  { value: 'third_base',  label: 'サードライナー' },
  { value: 'shortstop',   label: 'ショートライナー' },
  { value: 'left',        label: 'レフトライナー' },
  { value: 'center',      label: 'センターライナー' },
  { value: 'right',       label: 'ライトライナー' },
]

const RESULT_GROUPS: { label: string; color: string; activeColor: string; cols: string; items: ResultType[] }[] = [
  {
    label: '安打',
    color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40',
    activeColor: 'bg-green-600 border-green-600 text-white',
    cols: 'grid-cols-4',
    items: ['hit', 'double', 'triple', 'hr'],
  },
  {
    label: 'アウト',
    color: 'bg-lv2 border-s2 text-main hover:bg-lv2',
    activeColor: 'bg-sub1 border-sub1 text-white',
    cols: 'grid-cols-5',
    items: ['strikeout', 'groundout', 'flyout', 'infield_flyout', 'liner_out'],
  },
  {
    label: '出塁',
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40',
    activeColor: 'bg-blue-600 border-blue-600 text-white',
    cols: 'grid-cols-2',
    items: ['walk', 'hbp'],
  },
  {
    label: 'その他',
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40',
    activeColor: 'bg-purple-600 border-purple-600 text-white',
    cols: 'grid-cols-4',
    items: ['sac_bunt', 'sac_fly', 'error', 'fc'],
  },
]

const RESULT_SHORT: Record<ResultType, string> = {
  hit: '単打', double: '二塁打', triple: '三塁打', hr: '本塁打',
  strikeout: '三振', groundout: '内野ゴロ', flyout: '外野フライ', infield_flyout: '内野フライ', liner_out: 'ライナー',
  walk: '四球', hbp: '死球',
  sac_bunt: '犠打', sac_fly: '犠飛', error: 'エラー', fc: 'FC',
}

const OUTFIELD_DIRECTIONS: { value: OutfieldDirection; label: string }[] = [
  { value: 'left', label: 'レフト' },
  { value: 'left_center', label: '左中間' },
  { value: 'center', label: 'センター' },
  { value: 'right_center', label: '右中間' },
  { value: 'right', label: 'ライト' },
]

// 内野ゴロ守備位置（頻度順）
const GROUNDOUT_POSITIONS: { value: InfieldPosition; label: string }[] = [
  { value: 'third_base', label: 'サードゴロ' },
  { value: 'shortstop', label: 'ショートゴロ' },
  { value: 'second_base', label: 'セカンドゴロ' },
  { value: 'first_base', label: 'ファーストゴロ' },
  { value: 'pitcher', label: 'ピッチャーゴロ' },
  { value: 'catcher', label: 'キャッチャーゴロ' },
]

// 内野フライ守備位置
const INFIELD_FLY_POSITIONS: { value: InfieldPosition; label: string }[] = [
  { value: 'third_base', label: 'サードフライ' },
  { value: 'shortstop', label: 'ショートフライ' },
  { value: 'second_base', label: 'セカンドフライ' },
  { value: 'first_base', label: 'ファーストフライ' },
  { value: 'pitcher', label: 'ピッチャーフライ' },
  { value: 'catcher', label: 'キャッチャーフライ' },
]

// エラー守備位置（全9ポジション）
const ERROR_POSITIONS: { value: Direction; label: string }[] = [
  { value: 'pitcher',     label: 'ピッチャー' },
  { value: 'catcher',     label: 'キャッチャー' },
  { value: 'first_base',  label: 'ファースト' },
  { value: 'second_base', label: 'セカンド' },
  { value: 'third_base',  label: 'サード' },
  { value: 'shortstop',   label: 'ショート' },
  { value: 'left',        label: 'レフト' },
  { value: 'center',      label: 'センター' },
  { value: 'right',       label: 'ライト' },
]

// FC守備位置（内野6ポジション）
const FC_POSITIONS: { value: InfieldPosition; label: string }[] = [
  { value: 'third_base',  label: 'サードFC' },
  { value: 'shortstop',   label: 'ショートFC' },
  { value: 'second_base', label: 'セカンドFC' },
  { value: 'first_base',  label: 'ファーストFC' },
  { value: 'pitcher',     label: 'ピッチャーFC' },
  { value: 'catcher',     label: 'キャッチャーFC' },
]

// 内野安打守備位置（5ポジション）
const INFIELD_HIT_POSITIONS: { value: InfieldPosition; label: string }[] = [
  { value: 'pitcher',     label: 'ピッチャー内野安打' },
  { value: 'catcher',     label: 'キャッチャー内野安打' },
  { value: 'first_base',  label: 'ファースト内野安打' },
  { value: 'second_base', label: 'セカンド内野安打' },
  { value: 'shortstop',   label: 'ショート内野安打' },
]

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function ResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win')  return <span className="text-green-600 dark:text-green-400 font-bold">勝</span>
  if (result === 'loss') return <span className="text-red-600 dark:text-red-400 font-bold">負</span>
  return <span className="text-yellow-600 dark:text-yellow-400 font-bold">分</span>
}

// 数量選択ボタン（打点・盗塁用）
function CountSelector({
  label,
  value,
  onChange,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  max: number
}) {
  const options = Array.from({ length: max + 1 }, (_, i) => i)
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-sub1 w-8 shrink-0">{label}</span>
      <div className="flex gap-1">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-lg border text-sm font-medium transition-all ${
              value === n
                ? 'bg-theme/100 border-theme dark:bg-theme dark:border-theme/30 text-white'
                : 'border-s2 text-sub1 hover:border-theme/50 hover:bg-theme/10'
            }`}
          >
            {n === 0 ? 'なし' : n}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AtBatsPage() {
  const params = useParams()
  const gameId = params.id as string
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const formRef = useRef<HTMLDivElement>(null)

  const [game, setGame] = useState<Game | null>(null)
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [loading, setLoading] = useState(true)
  const [prevGame, setPrevGame] = useState<NavGame | null>(null)
  const [nextGame, setNextGame] = useState<NavGame | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  // N-3: カウント記録（任意）
  const [countBalls, setCountBalls] = useState<number | null>(null)
  const [countStrikes, setCountStrikes] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')

  // 編集モード
  const [editingAtBatId, setEditingAtBatId] = useState<string | null>(null)

  // フォーム状態
  const [battingOrder, setBattingOrder] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baseball_preferred_order')
      return saved ? parseInt(saved, 10) : 1
    }
    return 1
  })
  const [resultType, setResultType] = useState<ResultType | null>(null)
  const [direction, setDirection] = useState<Direction | null>(null)
  const [fieldingPosition, setFieldingPosition] = useState<FieldingPosition | null>(null)
  const [rbiCount, setRbiCount] = useState<number>(0)
  const [isRun, setIsRun] = useState(false)
  const [stolenBaseCount, setStolenBaseCount] = useState<number>(0)

  const fetchData = useCallback(async () => {
    const [{ data: gameData }, { data: atBatsData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('at_bats').select('*').eq('game_id', gameId).order('at_bat_number'),
    ])
    setGame(gameData)
    setAtBats(atBatsData ?? [])
    setLoading(false)
  }, [gameId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 前後ゲームナビ取得（game がロードされた後に一度だけ）
  useEffect(() => {
    if (!game) return
    const fetchNavGames = async () => {
      const [{ data: prev }, { data: next }] = await Promise.all([
        supabase.from('games').select('id, game_date, opponent')
          .lt('game_date', game.game_date)
          .order('game_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('games').select('id, game_date, opponent')
          .gt('game_date', game.game_date)
          .order('game_date', { ascending: true })
          .limit(1)
          .maybeSingle(),
      ])
      setPrevGame(prev as NavGame ?? null)
      setNextGame(next as NavGame ?? null)
    }
    fetchNavGames()
  }, [game?.game_date, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // 同一試合内で最後の打席のポジションを引き継ぐ（新規入力モード時のみ）
  useEffect(() => {
    if (atBats.length > 0 && !editingAtBatId) {
      const lastAb = atBats[atBats.length - 1]
      if (lastAb.fielding_position) {
        setFieldingPosition(lastAb.fielding_position as FieldingPosition)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atBats])

  const resetForm = () => {
    setEditingAtBatId(null)
    setBattingOrder(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('baseball_preferred_order')
        return saved ? parseInt(saved, 10) : 1
      }
      return 1
    })
    setResultType(null)
    setDirection(null)
    setFieldingPosition(null)
    setRbiCount(0)
    setIsRun(false)
    setStolenBaseCount(0)
  }

  const resetFormKeepOrder = () => {
    setEditingAtBatId(null)
    setResultType(null)
    setDirection(null)
    // fieldingPosition はリセットしない（同試合内で前打席のポジションを引き継ぐ）
    setRbiCount(0)
    setIsRun(false)
    setStolenBaseCount(0)
    setCountBalls(null)
    setCountStrikes(null)
  }

  const handleResultTypeChange = (rt: ResultType) => {
    setResultType(rt)
    setDirection(null)
  }

  // 編集開始：フォームに既存データをセットしてスクロール
  const handleEditAtBat = (ab: AtBat) => {
    setEditingAtBatId(ab.id)
    setBattingOrder(ab.batting_order)
    setResultType(ab.result_type as ResultType)
    setDirection(ab.direction as Direction | null)
    setFieldingPosition(ab.fielding_position as FieldingPosition | null)
    setRbiCount(ab.rbi_count ?? (ab.is_rbi ? 1 : 0))
    setIsRun(ab.is_run)
    setStolenBaseCount(ab.stolen_base_count ?? (ab.is_stolen_base ? 1 : 0))
    setCountBalls(ab.count_balls ?? null)
    setCountStrikes(ab.count_strikes ?? null)
    setSubmitError('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

    const saveDirection = SHOW_OUTFIELD_DIRECTION.includes(resultType) ||
                          SHOW_INFIELD_POSITION.includes(resultType) ||
                          resultType === 'error' ||
                          resultType === 'fc' ||
                          resultType === 'liner_out'
    const directionValue = saveDirection ? direction : null

    if (editingAtBatId) {
      // 編集モード：UPDATE
      const { error } = await supabase.from('at_bats').update({
        batting_order: battingOrder,
        result_type: resultType,
        hit_type: hitType,
        direction: directionValue,
        fielding_position: fieldingPosition ?? null,
        is_rbi: rbiCount > 0,
        rbi_count: rbiCount,
        is_run: isRun,
        is_stolen_base: stolenBaseCount > 0,
        stolen_base_count: stolenBaseCount,
        is_error: resultType === 'error',
        count_balls: countBalls,
        count_strikes: countStrikes,
      }).eq('id', editingAtBatId)

      if (error) {
        setSubmitError('更新に失敗しました。もう一度お試しください。')
        setSubmitting(false)
        return
      }
    } else {
      // 新規登録：INSERT
      const { error } = await supabase.from('at_bats').insert({
        game_id: gameId,
        user_id: user.id,
        at_bat_number: atBats.length + 1,
        batting_order: battingOrder,
        result_type: resultType,
        hit_type: hitType,
        direction: directionValue,
        fielding_position: fieldingPosition ?? null,
        is_rbi: rbiCount > 0,
        rbi_count: rbiCount,
        is_run: isRun,
        is_stolen_base: stolenBaseCount > 0,
        stolen_base_count: stolenBaseCount,
        is_caught_stealing: false,
        is_error: resultType === 'error',
        input_method: 'manual',
        count_balls: countBalls,
        count_strikes: countStrikes,
      })

      if (error) {
        setSubmitError('登録に失敗しました。もう一度お試しください。')
        setSubmitting(false)
        return
      }
    }

    resetFormKeepOrder()
    setSubmitting(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 800)
    fetchData()
  }

  const handleDeleteAtBat = async (id: string) => {
    setDeletingId(id)
    await supabase.from('at_bats').delete().eq('id', id)
    setDeletingId(null)
    if (editingAtBatId === id) resetForm()
    fetchData()
  }

  // M6-4: 打席並び替え（↑/↓で隣接レコードの at_bat_number を入れ替え）
  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const cur = atBats[index]
    const prev = atBats[index - 1]
    setMovingId(cur.id)
    await Promise.all([
      supabase.from('at_bats').update({ at_bat_number: prev.at_bat_number }).eq('id', cur.id),
      supabase.from('at_bats').update({ at_bat_number: cur.at_bat_number }).eq('id', prev.id),
    ])
    setMovingId(null)
    fetchData()
  }

  const handleMoveDown = async (index: number) => {
    if (index === atBats.length - 1) return
    const cur = atBats[index]
    const next = atBats[index + 1]
    setMovingId(cur.id)
    await Promise.all([
      supabase.from('at_bats').update({ at_bat_number: next.at_bat_number }).eq('id', cur.id),
      supabase.from('at_bats').update({ at_bat_number: cur.at_bat_number }).eq('id', next.id),
    ])
    setMovingId(null)
    fetchData()
  }

  if (loading) {
    return <div className="min-h-[520px] flex items-center justify-center text-sub2">読み込み中...</div>
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-sub2">試合が見つかりません</p>
        <Link href="/games" className="text-accent hover:underline mt-2 block">試合一覧へ</Link>
      </div>
    )
  }

  const showOutfieldDirection = resultType ? SHOW_OUTFIELD_DIRECTION.includes(resultType) : false
  const showInfieldPosition = resultType ? SHOW_INFIELD_POSITION.includes(resultType) : false
  const showErrorPosition = resultType === 'error'
  const showFCPosition = resultType === 'fc'
  const showLinerPosition = resultType ? SHOW_LINER_POSITION.includes(resultType) : false

  // 現試合の累計成績（atBats state から計算）
  const gameAb = atBats.filter(a =>
    ['hit','double','triple','hr','strikeout','groundout','flyout','infield_flyout','liner_out','sac_fly','error','fc'].includes(a.result_type)
  ).length
  const gameHits = atBats.filter(a =>
    ['hit','double','triple','hr'].includes(a.result_type)
  ).length
  const gameHrs = atBats.filter(a => a.result_type === 'hr').length
  const gameRbi = atBats.reduce((s, a) => s + (a.rbi_count ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ヘッダー */}
      <div className="space-y-2">
        <Link href="/games" className="text-sub2 hover:text-main transition-colors text-sm flex items-center gap-1">
          ← 試合一覧
        </Link>
        <GameNavBar prevGame={prevGame} nextGame={nextGame} />
        {/* H8-16: 同一試合内ナビ */}
        <div className="flex gap-2">
          <Link
            href={`/games/${gameId}/pitching`}
            className="flex-1 text-center py-1.5 text-xs font-medium bg-theme hover:opacity-90 text-white rounded-lg"
          >
            ⚾ 投球入力
          </Link>
          <Link
            href={`/games/${gameId}`}
            className="flex-1 text-center py-1.5 text-xs font-medium bg-lv2 border border-s2 text-main rounded-lg hover:bg-s2 transition-colors"
          >
            📋 試合サマリー
          </Link>
        </div>
      </div>

      <div className="bg-theme dark:bg-lv1 border border-theme/30 dark:border-s2 text-white rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-white/80 dark:text-sub1">{formatDate(game.game_date)}</div>
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
        <div className="mt-2 text-sm text-white/80 dark:text-sub1">
          {atBats.length}打席記録済み
        </div>
        {atBats.length > 0 && (
          <div className="mt-0.5 text-xs text-sub2">
            {gameHits}安打/{gameAb}打数{gameHrs >= 1 ? ` ${gameHrs}HR` : ''}{gameRbi >= 1 ? ` ${gameRbi}打点` : ''}
          </div>
        )}
      </div>

      {/* 打席入力フォーム */}
      <div ref={formRef} className="bg-lv1 rounded-xl shadow-sm border border-s2 p-5 space-y-5">
        {/* 編集モードバナー */}
        {editingAtBatId ? (
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-accent flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              打席 #{atBats.find(ab => ab.id === editingAtBatId)?.at_bat_number} を編集中
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-sub2 hover:text-main transition-colors"
            >
              キャンセル
            </button>
          </div>
        ) : (
          // P-4: 前打席コピーボタン
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-main">打席を追加</h2>
            {atBats.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const last = atBats[atBats.length - 1]
                  setResultType(last.result_type as ResultType)
                  setDirection(last.direction as Direction | null)
                }}
                className="text-xs text-theme border border-theme/40 rounded-lg px-2.5 py-1 hover:bg-theme/10 transition-colors"
              >
                前打席をコピー（{RESULT_SHORT[atBats[atBats.length - 1].result_type as ResultType]}）
              </button>
            )}
          </div>
        )}

        {submitError && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">{submitError}</div>
        )}

        {/* 打順 */}
        <div>
          <label className="block text-sm font-medium text-sub1 mb-2">
            打順 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-6 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                setBattingOrder(n)
                if (typeof window !== 'undefined') {
                  localStorage.setItem('baseball_preferred_order', String(n))
                }
              }}
                className={`py-3 rounded-lg text-sm font-bold border-2 transition-all ${
                  battingOrder === n
                    ? 'bg-theme border-theme dark:border-theme/30 text-white'
                    : 'border-s2 text-sub1 hover:border-theme/50 hover:bg-theme/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 守備ポジション（任意） */}
        <div>
          <label className="block text-sm font-medium text-sub1 mb-2">
            守備ポジション
            <span className="ml-1.5 text-[10px] bg-lv2 text-sub2 border border-s2 rounded px-1.5 py-0.5 font-normal">任意</span>
          </label>
          <div className="grid grid-cols-5 gap-1.5">
            {FIELDING_POSITIONS.map(({ value, label, full }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFieldingPosition(fp => fp === value ? null : value)}
                title={full}
                className={`py-2.5 rounded-lg border text-sm font-bold transition-colors ${
                  fieldingPosition === value
                    ? 'bg-theme border-theme text-white'
                    : 'bg-lv2 border-s2 text-main hover:bg-lv1'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {fieldingPosition && (
            <p className="text-xs text-theme mt-1.5 flex items-center gap-1">
              {FIELDING_POSITIONS.find(p => p.value === fieldingPosition)?.full} を選択中
              <button
                type="button"
                onClick={() => setFieldingPosition(null)}
                className="text-sub2 hover:text-neg-t ml-1 transition-colors"
              >
                ✕ 解除
              </button>
            </p>
          )}
        </div>

        {/* N-3: 最終カウント（任意） */}
        <div>
          <label className="block text-sm font-medium text-sub1 mb-2">
            最終カウント
            <span className="ml-1.5 text-[10px] bg-lv2 text-sub2 border border-s2 rounded px-1.5 py-0.5 font-normal">任意</span>
          </label>
          <div className="space-y-2">
            {/* ボール */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-sub1 w-12 shrink-0">ボール</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCountBalls(countBalls === n ? null : n)}
                    className={`w-10 h-9 rounded-lg border text-sm font-medium transition-all ${
                      countBalls === n
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-s2 text-sub1 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {/* ストライク */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-sub1 w-12 shrink-0">ストライク</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCountStrikes(countStrikes === n ? null : n)}
                    className={`w-10 h-9 rounded-lg border text-sm font-medium transition-all ${
                      countStrikes === n
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'border-s2 text-sub1 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(countBalls !== null || countStrikes !== null) && (
            <p className="text-xs text-theme mt-1.5 flex items-center gap-1">
              {countBalls !== null ? `${countBalls}B` : '?B'} - {countStrikes !== null ? `${countStrikes}S` : '?S'} で記録
              <button
                type="button"
                onClick={() => { setCountBalls(null); setCountStrikes(null) }}
                className="text-sub2 hover:text-neg-t ml-1 transition-colors"
              >
                ✕ 解除
              </button>
            </p>
          )}
        </div>

        {/* 結果 */}
        <div>
          <label className="block text-sm font-medium text-sub1 mb-2">
            結果 <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {RESULT_GROUPS.map((group) => (
              <div key={group.label} className={`grid ${group.cols} gap-1.5`}>
                {group.items.map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => handleResultTypeChange(rt)}
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

        {/* 内野ゴロ守備位置 */}
        {showInfieldPosition && resultType === 'groundout' && (
          <div>
            <label className="block text-sm font-medium text-sub1 mb-2">
              守備位置
              <span className="text-sub2 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {GROUNDOUT_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-sub1 border-sub1 text-white'
                      : 'bg-lv2 border-s2 text-main hover:bg-lv2'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 内野フライ守備位置 */}
        {showInfieldPosition && resultType === 'infield_flyout' && (
          <div>
            <label className="block text-sm font-medium text-sub1 mb-2">
              守備位置
              <span className="text-sub2 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {INFIELD_FLY_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-sub1 border-sub1 text-white'
                      : 'bg-lv2 border-s2 text-main hover:bg-lv2'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* エラー守備位置（全9ポジション） */}
        {showErrorPosition && (
          <div>
            <label className="block text-sm font-medium text-sub1 mb-2">
              守備位置
              <span className="text-sub2 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {ERROR_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FC守備位置（内野6ポジション） */}
        {showFCPosition && (
          <div>
            <label className="block text-sm font-medium text-sub1 mb-2">
              守備位置
              <span className="text-sub2 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {FC_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ライナー守備位置（内野5種・外野3種） */}
        {showLinerPosition && (
          <div>
            <label className="block text-sm font-medium text-sub1 mb-2">
              ライナー先
              <span className="text-sub2 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {LINER_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-sub1 border-sub1 text-white'
                      : 'bg-lv2 border-s2 text-main hover:bg-lv2'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 内野安打守備位置（単打のみ） */}
        {resultType === 'hit' && (
          <div>
            <label className="block text-sm font-medium text-sub1 mb-2">
              内野安打方向
              <span className="text-sub2 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {INFIELD_HIT_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 外野打球方向（安打・外野フライなど） */}
        {showOutfieldDirection && (
          <div>
            <label className="block text-sm font-medium text-sub1 mb-2">
              {resultType === 'hit' ? '外野安打方向' : '打球方向'}
              <span className="text-sub2 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {OUTFIELD_DIRECTIONS.map((dir) => (
                <button
                  key={dir.value}
                  type="button"
                  onClick={() => setDirection(direction === dir.value ? null : dir.value)}
                  className={`py-3 rounded-lg border text-xs font-medium transition-all ${
                    direction === dir.value
                      ? 'bg-field-500 border-field-500 text-white'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40'
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
          <label className="block text-sm font-medium text-sub1 mb-3">付加情報</label>
          <div className="space-y-3">
            {/* 打点（1〜4選択） */}
            <CountSelector
              label="打点"
              value={rbiCount}
              onChange={setRbiCount}
              max={4}
            />

            {/* 得点（チェックボックス） */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-sub1 w-8 shrink-0">得点</span>
              <div
                onClick={() => setIsRun(!isRun)}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                  isRun
                    ? 'bg-theme border-theme dark:border-theme/30 text-white'
                    : 'border-s2 text-sub2 hover:border-theme/50 hover:bg-theme/10'
                }`}
              >
                {isRun ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-xs font-medium">あり</span>
                )}
              </div>
            </div>

            {/* 盗塁（1〜3選択） */}
            <CountSelector
              label="盗塁"
              value={stolenBaseCount}
              onChange={setStolenBaseCount}
              max={3}
            />
          </div>
        </div>

        <div className="flex gap-3">
          {editingAtBatId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex-none px-6 py-4 rounded-xl border-2 border-s2 text-sub1 font-bold text-base transition-colors hover:bg-lv2"
            >
              キャンセル
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !battingOrder || !resultType}
            className={`flex-1 text-white py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 ${
              editingAtBatId
                ? 'bg-theme hover:opacity-90'
                : 'bg-theme hover:opacity-90'
            }`}
          >
            {submitting
              ? (editingAtBatId ? '更新中...' : '登録中...')
              : saved
              ? '打席入力完了 ✓'
              : (editingAtBatId ? '打席を更新する' : '打席を記録する')}
          </button>
        </div>
      </div>

      {/* 打席一覧 */}
      {atBats.length > 0 && (
        <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-5">
          <h2 className="font-semibold text-main mb-4">打席記録</h2>
          <div className="space-y-2">
            {atBats.map((ab, index) => {
              const label = getAtBatLabel(ab.result_type as ResultType, ab.direction as Direction | null)
              const isPositionInLabel = ab.result_type === 'groundout' ||
                                        ab.result_type === 'infield_flyout' ||
                                        ab.result_type === 'error' ||
                                        (ab.result_type === 'hit' && !!ab.direction) ||
                                        (ab.result_type === 'fc' && !!ab.direction)
              const isEditing = editingAtBatId === ab.id
              const isMoving = movingId === ab.id
              const rbiVal = ab.rbi_count ?? (ab.is_rbi ? 1 : 0)
              const sbVal = ab.stolen_base_count ?? (ab.is_stolen_base ? 1 : 0)
              return (
                <div
                  key={ab.id}
                  className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
                    isEditing ? 'bg-theme/10 ring-2 ring-theme/30' : 'bg-lv2'
                  }`}
                >
                  {/* M6-4: ↑/↓ 並び替えボタン */}
                  <div className="flex flex-col gap-0.5 shrink-0 mr-1.5">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0 || !!movingId || !!deletingId}
                      aria-label={`打席 #${ab.at_bat_number} を上へ移動`}
                      className="w-5 h-5 flex items-center justify-center text-sub2 hover:text-main disabled:opacity-20 transition-colors leading-none"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === atBats.length - 1 || !!movingId || !!deletingId}
                      aria-label={`打席 #${ab.at_bat_number} を下へ移動`}
                      className="w-5 h-5 flex items-center justify-center text-sub2 hover:text-main disabled:opacity-20 transition-colors leading-none"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                    <span className="text-xs text-sub2 w-7 shrink-0">#{ab.at_bat_number}</span>
                    <span className="text-xs bg-theme/15 text-accent px-1.5 py-0.5 rounded font-medium shrink-0">
                      {ab.batting_order}番
                    </span>
                    <span className={`text-sm font-medium text-main ${isMoving ? 'opacity-50' : ''}`}>
                      {label}
                    </span>
                    {ab.direction && !isPositionInLabel && (
                      <span className="text-xs text-sub1">
                        → {DIRECTION_LABELS[ab.direction as Direction]}
                      </span>
                    )}
                    <div className="flex gap-1 flex-wrap">
                      {rbiVal > 0 && (
                        <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">
                          打点{rbiVal > 1 ? rbiVal : ''}
                        </span>
                      )}
                      {ab.is_run && (
                        <span className="text-xs bg-theme/10 text-theme px-1.5 py-0.5 rounded font-medium">得点</span>
                      )}
                      {sbVal > 0 && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-medium">
                          盗塁{sbVal > 1 ? sbVal : ''}
                        </span>
                      )}
                      {(ab.count_balls !== null || ab.count_strikes !== null) && (
                        <span className="text-xs bg-lv2 text-sub2 px-1.5 py-0.5 rounded font-mono">
                          {ab.count_balls ?? '?'}B-{ab.count_strikes ?? '?'}S
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => handleEditAtBat(ab)}
                      disabled={!!deletingId || !!movingId}
                      aria-label={`打席 #${ab.at_bat_number} を編集`}
                      className="text-theme/60 hover:text-theme transition-colors text-xs disabled:opacity-50"
                    >
                      編集
                    </button>
                    <span className="text-s2">|</span>
                    <button
                      onClick={() => handleDeleteAtBat(ab.id)}
                      disabled={deletingId === ab.id || !!movingId}
                      aria-label={`打席 #${ab.at_bat_number} を削除`}
                      className="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300 transition-colors text-xs disabled:opacity-50"
                    >
                      {deletingId === ab.id ? '削除中' : '削除'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 保存トースト */}
      {savedFlash && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-pos text-pos-t text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-fade-in-out z-50 whitespace-nowrap">
          ✓ 保存しました
        </div>
      )}
    </div>
  )
}
