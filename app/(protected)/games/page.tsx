'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AtBat, GameWithAtBats } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

const AB_COUNTING_TYPES: AtBat['result_type'][] = [
  'hit', 'double', 'triple', 'hr',
  'strikeout', 'groundout', 'flyout', 'infield_flyout',
  'sac_fly', 'error', 'fc',
]
const HIT_TYPES: AtBat['result_type'][] = ['hit', 'double', 'triple', 'hr']

function AtBatStats({ atBats }: { atBats: AtBat[] }) {
  if (atBats.length === 0) {
    return <span className="text-sm text-sub2">記録なし</span>
  }
  const ab = atBats.filter(a => AB_COUNTING_TYPES.includes(a.result_type)).length
  const hits = atBats.filter(a => HIT_TYPES.includes(a.result_type)).length
  const hrs = atBats.filter(a => a.result_type === 'hr').length
  return (
    <span className="text-sm text-sub2">
      {hits}/{ab}{hrs > 0 ? ` ${hrs}HR` : ''}
    </span>
  )
}

function ScoreDisplay({ game }: { game: GameWithAtBats }) {
  const marker =
    game.result === 'win'  ? <span className="text-pos-t text-lg">○</span> :
    game.result === 'loss' ? <span className="text-sub2 text-lg">●</span> :
                             <span className="text-neu-t text-lg">△</span>
  return (
    <span className="flex items-center gap-1 font-bold leading-none shrink-0">
      {marker}
      <span className="text-main text-lg tabular-nums">
        {game.score_us}<span className="text-sub2 font-normal mx-0.5">-</span>{game.score_them}
      </span>
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className="px-4 py-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-5 bg-lv2 rounded" />
        <div className="h-5 bg-lv2 rounded w-40" />
      </div>
      <div className="h-3 bg-lv2 rounded w-28" />
    </div>
  )
}

type ResultFilter = 'all' | 'win' | 'loss' | 'draw'

export default function GamesPage() {
  const [games, setGames] = useState<GameWithAtBats[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [stadiumFilter, setStadiumFilter] = useState('')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const router = useRouter()

  const fetchGames = useCallback(async () => {
    const { data } = await supabase
      .from('games')
      .select('*, at_bats(*)')
      .order('game_date', { ascending: false })
    setGames((data ?? []) as GameWithAtBats[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchGames() }, [fetchGames])

  // 球場リストを動的取得
  const stadiums = useMemo(() => {
    const s = new Set<string>()
    for (const g of games) { if (g.stadium) s.add(g.stadium) }
    return Array.from(s).sort()
  }, [games])

  // フィルタリング
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const needle = searchText.trim().normalize('NFKC').toLowerCase()
      const hay = g.opponent.normalize('NFKC').toLowerCase()
      const matchText = needle === '' || hay.includes(needle)
      const matchResult = resultFilter === 'all' || g.result === resultFilter
      const matchStadium = stadiumFilter === '' || g.stadium === stadiumFilter
      return matchText && matchResult && matchStadium
    })
  }, [games, searchText, resultFilter, stadiumFilter])

  const isFiltered = searchText.trim() !== '' || resultFilter !== 'all' || stadiumFilter !== ''

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await supabase.from('games').delete().eq('id', id)
    setConfirmId(null)
    setDeletingId(null)
    fetchGames()
  }

  const card = "bg-lv1 rounded-xl shadow-sm border border-s2"

  const RESULT_FILTERS: { value: ResultFilter; label: string }[] = [
    { value: 'all',  label: 'すべて' },
    { value: 'win',  label: '勝' },
    { value: 'loss', label: '負' },
    { value: 'draw', label: '分' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">試合一覧</h1>
        <Link href="/games/new" className="btn bg-theme hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium">
          ＋ 試合を登録
        </Link>
      </div>

      {/* ─── 検索・絞り込みバー ─── */}
      {!loading && games.length > 0 && (
        <div className="bg-lv1 rounded-xl border border-s2 p-3 space-y-2.5">
          {/* テキスト検索 + 件数 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sub2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="対戦相手で検索…"
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-s2 rounded-lg bg-lv1 text-main placeholder-sub2 focus:outline-none focus:ring-2 focus:ring-theme"
              />
            </div>
            {isFiltered && (
              <span className="text-xs text-sub2 whitespace-nowrap shrink-0">
                {filteredGames.length}件 / 全{games.length}件
              </span>
            )}
          </div>

          {/* 結果フィルター + 球場フィルター */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {RESULT_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setResultFilter(value)}
                  className={`px-3 py-1 text-xs rounded-lg border font-medium transition-colors ${
                    resultFilter === value
                      ? 'bg-theme text-white border-theme'
                      : 'bg-lv2 border-s2 text-sub2 hover:text-main'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {stadiums.length > 0 && (
              <select
                value={stadiumFilter}
                onChange={e => setStadiumFilter(e.target.value)}
                className="text-xs border border-s2 rounded-lg px-2 py-1 bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme"
              >
                <option value="">球場: すべて</option>
                {stadiums.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className={`min-h-[520px] ${card} divide-y divide-s2`}>
          {[1,2,3].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : games.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <div className="text-5xl mb-4">⚾</div>
          <p className="text-sub2 mb-4">試合が登録されていません</p>
          <Link href="/games/new" className="btn inline-block bg-theme hover:opacity-90 text-white px-6 py-2 rounded-lg text-sm font-medium">
            最初の試合を登録する
          </Link>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sub2">条件に一致する試合がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGames.map((game) => (
            <div key={game.id} className={`${card} overflow-hidden`}>
              {/* メイン行 → 詳細ページへ */}
              <Link
                href={`/games/${game.id}`}
                className="flex items-center justify-between px-4 py-4 hover:bg-lv2 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ScoreDisplay game={game} />
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-main truncate">vs {game.opponent}</div>
                    <div className="text-xs text-sub2 mt-0.5">
                      {formatDate(game.game_date)}
                      {game.stadium && <span className="ml-1.5">・ {game.stadium}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AtBatStats atBats={game.at_bats ?? []} />
                  <svg className="w-4 h-4 text-sub2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>

              {/* アクションボタン */}
              {confirmId === game.id ? (
                <div className="border-t border-s2 px-4 py-3">
                  <p className="text-xs text-red-400 font-medium mb-2">この試合と全打席記録を削除しますか？</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="btn flex-1 py-2 text-xs text-sub1 bg-lv2 hover:bg-lv2 rounded-lg font-medium"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleDelete(game.id)}
                      disabled={deletingId === game.id}
                      className="btn flex-1 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      {deletingId === game.id ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-s2 px-3 py-2.5 flex gap-1.5">
                  <Link
                    href={`/games/${game.id}/at-bats`}
                    className="btn flex-1 text-center py-1.5 text-xs font-medium bg-field-500 hover:bg-field-600 text-white rounded-lg"
                  >
                    打席入力
                  </Link>
                  <Link
                    href={`/games/${game.id}/pitching`}
                    className="btn flex-1 text-center py-1.5 text-xs font-medium bg-theme hover:opacity-90 text-white rounded-lg"
                  >
                    投手成績
                  </Link>
                  <Link
                    href={`/games/${game.id}/edit`}
                    className="btn flex-1 text-center py-1.5 text-xs font-medium bg-lv2 hover:bg-lv2 text-main rounded-lg border border-s2"
                  >
                    編集
                  </Link>
                  <button
                    onClick={() => setConfirmId(game.id)}
                    className="btn flex-1 py-1.5 text-xs font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    削除
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
