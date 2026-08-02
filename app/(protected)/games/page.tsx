'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { type AtBat, type GameWithAtBats, type PitchingStat } from '@/lib/supabase/types'
import GamesCalendar from './_components/GamesCalendar'
import GamesTableView from './_components/GamesTableView'
import GamesListCard from './_components/GamesListCard'

// M8-5 / R-4: pitching_stats を一括取得して投手サマリも算出
interface GameWithPitching extends GameWithAtBats {
  pitching_stats: PitchingStat[]
}

// P-1: 期間フィルターヘルパー
function matchPeriod(gameDate: string, filter: string): boolean {
  if (filter === 'all') return true
  const y = parseInt(gameDate.slice(0, 4))
  const m = parseInt(gameDate.slice(5, 7))
  if (filter.includes('-H1')) return y === parseInt(filter.split('-')[0]) && m >= 1 && m <= 6
  if (filter.includes('-H2')) return y === parseInt(filter.split('-')[0]) && m >= 7 && m <= 12
  return y === parseInt(filter)
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
type ViewMode = 'list' | 'calendar' | 'table'

const PAGE_SIZE = 50

export default function GamesPage() {
  const [games, setGames] = useState<GameWithPitching[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const [resultFilter, setResultFilter] = useState<ResultFilter>(
    () => (typeof window !== 'undefined' ? (sessionStorage.getItem('games_result') as ResultFilter) ?? 'all' : 'all')
  )
  const [stadiumFilter, setStadiumFilter] = useState(
    () => (typeof window !== 'undefined' ? sessionStorage.getItem('games_stadium') ?? '' : '')
  )
  const [periodFilter, setPeriodFilter] = useState<string>(
    () => (typeof window !== 'undefined' ? sessionStorage.getItem('games_period') ?? 'all' : 'all')
  )
  // S-4b: viewMode を sessionStorage から復元
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (typeof window !== 'undefined'
      ? (sessionStorage.getItem('games_view') as ViewMode) ?? 'list'
      : 'list')
  )
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchGames = useCallback(async () => {
    const { data } = await supabase
      .from('games')
      .select('*, at_bats(*), pitching_stats(*)')
      .order('game_date', { ascending: false })
      .range(0, PAGE_SIZE - 1)
    const rows = (data ?? []) as GameWithPitching[]
    setGames(rows)
    setHasMore(rows.length === PAGE_SIZE)
    setLoading(false)
  }, [supabase])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    const { data } = await supabase
      .from('games')
      .select('*, at_bats(*), pitching_stats(*)')
      .order('game_date', { ascending: false })
      .range(games.length, games.length + PAGE_SIZE - 1)
    const rows = (data ?? []) as GameWithPitching[]
    setGames((prev) => [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoadingMore(false)
  }, [supabase, games.length])

  useEffect(() => { fetchGames() }, [fetchGames])

  // 球場リストを動的取得
  const stadiums = useMemo(() => {
    const s = new Set<string>()
    for (const g of games) { if (g.stadium) s.add(g.stadium) }
    return Array.from(s).sort()
  }, [games])

  // P-1: 期間オプションを動的生成
  const periodOptions = useMemo(() => {
    const years = new Set<number>()
    for (const g of games) years.add(parseInt(g.game_date.slice(0, 4)))
    const opts: { value: string; label: string }[] = []
    const sortedYears = Array.from(years).sort((a, b) => b - a)
    for (const y of sortedYears) {
      opts.push({ value: `${y}`,     label: `${y}年` })
      opts.push({ value: `${y}-H1`, label: `${y}年 上期（1〜6月）` })
      opts.push({ value: `${y}-H2`, label: `${y}年 下期（7〜12月）` })
    }
    return opts
  }, [games])

  // フィルタリング
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const needle = searchText.trim().normalize('NFKC').toLowerCase()
      const hay = g.opponent.normalize('NFKC').toLowerCase()
      const matchText    = needle === '' || hay.includes(needle)
      const matchResult  = resultFilter === 'all' || g.result === resultFilter
      const matchStadium = stadiumFilter === '' || g.stadium === stadiumFilter
      const matchPd      = matchPeriod(g.game_date, periodFilter)
      return matchText && matchResult && matchStadium && matchPd
    })
  }, [games, searchText, resultFilter, stadiumFilter, periodFilter])

  // S-2: リストビュー用・年別グルーピング
  const groupedByYear = useMemo(() => {
    const map = new Map<number, GameWithPitching[]>()
    for (const g of filteredGames) {
      const yr = (g as GameWithPitching & { season?: number }).season
        ?? parseInt(g.game_date.slice(0, 4))
      if (!map.has(yr)) map.set(yr, [])
      map.get(yr)!.push(g)
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]) // 年降順
  }, [filteredGames])

  const isFiltered = searchText.trim() !== '' || resultFilter !== 'all' || stadiumFilter !== '' || periodFilter !== 'all'

  // P-2: 一括リセット
  const resetFilters = () => {
    setSearchText('')
    setResultFilter('all')
    setStadiumFilter('')
    setPeriodFilter('all')
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('games_result')
      sessionStorage.removeItem('games_stadium')
      sessionStorage.removeItem('games_period')
    }
  }

  // S-4b: viewMode セッター（sessionStorage 同時保存）
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('games_view', mode)
    }
  }

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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-accent">試合一覧</h1>
          {!loading && games.length > 0 && (
            <div className="flex gap-1">
              {/* S-4a: ボタン順序 リスト→表→月別 */}
              <button
                onClick={() => changeViewMode('list')}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-theme text-white border-theme'
                    : 'bg-lv2 border-s2 text-sub2 hover:text-main'
                }`}
              >☰ リスト</button>
              <button
                onClick={() => changeViewMode('table')}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-theme text-white border-theme'
                    : 'bg-lv2 border-s2 text-sub2 hover:text-main'
                }`}
              >📊 表</button>
              <button
                onClick={() => changeViewMode('calendar')}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-theme text-white border-theme'
                    : 'bg-lv2 border-s2 text-sub2 hover:text-main'
                }`}
              >📅 月別</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* R-2: 一括登録（ベボレコ移行・複数試合まとめて入力） */}
          <Link href="/games/bulk-new" className="btn bg-lv2 border border-s2 hover:bg-lv1 text-main px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            📝 まとめて登録
          </Link>
          <Link href="/games/bulk-stats" className="btn bg-lv2 border border-s2 hover:bg-lv1 text-main px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            📋 成績をまとめて編集
          </Link>
          <Link href="/games/new" className="btn bg-theme hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium">
            ＋ 試合を登録
          </Link>
        </div>
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
              <>
                <span className="text-xs text-sub2 whitespace-nowrap shrink-0">
                  {filteredGames.length}件 / 全{games.length}件
                </span>
                <button
                  onClick={resetFilters}
                  className="text-xs text-theme underline underline-offset-2 whitespace-nowrap shrink-0 hover:opacity-70"
                >
                  リセット
                </button>
              </>
            )}
          </div>

          {/* 結果フィルター + 球場フィルター */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {RESULT_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    setResultFilter(value)
                    sessionStorage.setItem('games_result', value)
                  }}
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
            {/* P-1: 期間フィルター */}
            {periodOptions.length > 0 && (
              <select
                value={periodFilter}
                onChange={e => {
                  setPeriodFilter(e.target.value)
                  sessionStorage.setItem('games_period', e.target.value)
                }}
                className="text-xs border border-s2 rounded-lg px-2 py-1 bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme"
              >
                <option value="all">期間: すべて</option>
                {periodOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            {stadiums.length > 0 && (
              <select
                value={stadiumFilter}
                onChange={e => {
                  setStadiumFilter(e.target.value)
                  sessionStorage.setItem('games_stadium', e.target.value)
                }}
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

      {/* P-8: カレンダービュー */}
      {!loading && viewMode === 'calendar' && (
        <GamesCalendar games={games} />
      )}

      {/* S-1: 表ビュー */}
      {!loading && viewMode === 'table' && (
        <GamesTableView games={filteredGames as GameWithPitching[]} />
      )}

      {/* リストビュー */}
      {viewMode === 'list' && (loading ? (
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
        <div className="space-y-4">
          {/* 最新N件バナー */}
          {hasMore && !searchText && resultFilter === 'all' && !stadiumFilter && periodFilter === 'all' && (
            <p className="text-xs text-sub2 text-center">最新{games.length}件を表示中</p>
          )}
          {/* S-2: 年別セクション */}
          {groupedByYear.map(([yr, yearGames]) => {
            const wins   = yearGames.filter(g => g.result === 'win').length
            const losses = yearGames.filter(g => g.result === 'loss').length
            const draws  = yearGames.filter(g => g.result === 'draw').length
            return (
              <div key={yr}>
                {/* 年セクションヘッダー */}
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="text-sm font-semibold text-sub1">{yr}年</span>
                  <span className="text-xs text-sub2">{yearGames.length}試合</span>
                  <span className="text-xs text-sub2">
                    {wins}勝{losses}敗{draws > 0 ? `${draws}分` : ''}
                  </span>
                </div>
                {/* 試合カードリスト（S-1・S-3） */}
                <div className="space-y-2">
                  {yearGames.map(game => (
                    <GamesListCard
                      key={game.id}
                      game={game}
                      confirmId={confirmId}
                      deletingId={deletingId}
                      onConfirm={setConfirmId}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          {/* さらに読み込む */}
          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-2 text-sm font-medium text-sub1 border border-s2 rounded-lg bg-lv1 hover:bg-lv2 transition-colors disabled:opacity-50"
              >
                {loadingMore ? '読み込み中...' : 'さらに読み込む'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
