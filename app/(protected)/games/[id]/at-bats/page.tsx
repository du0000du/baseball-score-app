'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  DIRECTION_LABELS,
  getAtBatLabel,
} from '@/lib/supabase/types'
import type { AtBat, Direction, Game, ResultType, OutfieldDirection, InfieldPosition } from '@/lib/supabase/types'

// 外野方向を表示する結果タイプ
const SHOW_OUTFIELD_DIRECTION: ResultType[] = [
  'hit', 'double', 'triple', 'hr',
  'flyout', 'sac_fly',
]

// 内野守備位置を表示する結果タイプ
const SHOW_INFIELD_POSITION: ResultType[] = ['groundout', 'infield_flyout']

// FC時に内野守備位置を表示
const SHOW_FC_POSITION: ResultType[] = ['fc']

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
    cols: 'grid-cols-4',
    items: ['strikeout', 'groundout', 'flyout', 'infield_flyout'],
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
  strikeout: '三振', groundout: '内野ゴロ', flyout: '外野フライ', infield_flyout: '内野フライ',
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
  if (result === 'win') return <span className="text-green-600 font-bold">勝</span>
  if (result === 'loss') return <span className="text-red-600 font-bold">負</span>
  return <span className="text-yellow-600 font-bold">分</span>
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
      <span className="text-sm text-gray-600 w-8 shrink-0">{label}</span>
      <div className="flex gap-1">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-9 h-9 rounded-lg border text-sm font-medium transition-all ${
              value === n
                ? 'bg-crimson-500 border-crimson-500 text-white'
                : 'border-gray-200 text-gray-600 hover:border-crimson-300 hover:bg-crimson-50'
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
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')

  // 編集モード
  const [editingAtBatId, setEditingAtBatId] = useState<string | null>(null)

  // フォーム状態
  const [battingOrder, setBattingOrder] = useState<number | null>(null)
  const [resultType, setResultType] = useState<ResultType | null>(null)
  const [direction, setDirection] = useState<Direction | null>(null)
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

  const resetForm = () => {
    setEditingAtBatId(null)
    setResultType(null)
    setDirection(null)
    setRbiCount(0)
    setIsRun(false)
    setStolenBaseCount(0)
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
    setRbiCount(ab.rbi_count ?? (ab.is_rbi ? 1 : 0))
    setIsRun(ab.is_run)
    setStolenBaseCount(ab.stolen_base_count ?? (ab.is_stolen_base ? 1 : 0))
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
                          resultType === 'fc'
    const directionValue = saveDirection ? direction : null

    if (editingAtBatId) {
      // 編集モード：UPDATE
      const { error } = await supabase.from('at_bats').update({
        batting_order: battingOrder,
        result_type: resultType,
        hit_type: hitType,
        direction: directionValue,
        is_rbi: rbiCount > 0,
        rbi_count: rbiCount,
        is_run: isRun,
        is_stolen_base: stolenBaseCount > 0,
        stolen_base_count: stolenBaseCount,
        is_error: resultType === 'error',
      }).eq('id', editingAtBatId)

      if (error) {
        setSubmitError('更新に失敗しました: ' + error.message)
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
        is_rbi: rbiCount > 0,
        rbi_count: rbiCount,
        is_run: isRun,
        is_stolen_base: stolenBaseCount > 0,
        stolen_base_count: stolenBaseCount,
        is_caught_stealing: false,
        is_error: resultType === 'error',
        input_method: 'manual',
      })

      if (error) {
        setSubmitError('登録に失敗しました: ' + error.message)
        setSubmitting(false)
        return
      }
    }

    resetForm()
    setSubmitting(false)
    fetchData()
  }

  const handleDeleteAtBat = async (id: string) => {
    setDeletingId(id)
    await supabase.from('at_bats').delete().eq('id', id)
    setDeletingId(null)
    if (editingAtBatId === id) resetForm()
    fetchData()
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">試合が見つかりません</p>
        <Link href="/games" className="text-crimson-500 hover:underline mt-2 block">試合一覧へ</Link>
      </div>
    )
  }

  const showOutfieldDirection = resultType ? SHOW_OUTFIELD_DIRECTION.includes(resultType) : false
  const showInfieldPosition = resultType ? SHOW_INFIELD_POSITION.includes(resultType) : false
  const showErrorPosition = resultType === 'error'
  const showFCPosition = resultType === 'fc'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/games" className="text-gray-400 hover:text-gray-600 transition-colors text-sm">
          ← 試合一覧
        </Link>
      </div>

      <div className="bg-crimson-500 text-white rounded-xl p-4">
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
      <div ref={formRef} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-5">
        {/* 編集モードバナー */}
        {editingAtBatId ? (
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-blue-700 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              打席 #{atBats.find(ab => ab.id === editingAtBatId)?.at_bat_number} を編集中
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <h2 className="font-semibold text-gray-700">打席を追加</h2>
        )}

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
                    ? 'bg-crimson-500 border-crimson-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-crimson-100 hover:bg-crimson-50'
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              守備位置
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {GROUNDOUT_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-gray-600 border-gray-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              守備位置
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {INFIELD_FLY_POSITIONS.map((pos) => (
                <button
                  key={pos.value}
                  type="button"
                  onClick={() => setDirection(direction === pos.value ? null : pos.value)}
                  className={`py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    direction === pos.value
                      ? 'bg-gray-600 border-gray-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              守備位置
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
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
                      : 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100'
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              守備位置
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
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
                      : 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100'
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              内野安打方向
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
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
                      : 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {resultType === 'hit' ? '外野安打方向' : '打球方向'}
              <span className="text-gray-400 font-normal ml-1">（任意）</span>
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
          <label className="block text-sm font-medium text-gray-600 mb-3">付加情報</label>
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
              <span className="text-sm text-gray-600 w-8 shrink-0">得点</span>
              <div
                onClick={() => setIsRun(!isRun)}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                  isRun
                    ? 'bg-crimson-500 border-crimson-500 text-white'
                    : 'border-gray-200 text-gray-400 hover:border-crimson-300 hover:bg-crimson-50'
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
              className="flex-none px-6 py-4 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-base transition-colors hover:bg-gray-50"
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
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-crimson-500 hover:bg-crimson-600'
            }`}
          >
            {submitting
              ? (editingAtBatId ? '更新中...' : '登録中...')
              : (editingAtBatId ? '打席を更新する' : '打席を記録する')}
          </button>
        </div>
      </div>

      {/* 打席一覧 */}
      {atBats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">打席記録</h2>
          <div className="space-y-2">
            {atBats.map((ab) => {
              const label = getAtBatLabel(ab.result_type as ResultType, ab.direction as Direction | null)
              const isPositionInLabel = ab.result_type === 