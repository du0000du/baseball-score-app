'use client'

import { useEffect, useState, useRef, useContext } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP } from '@/lib/stats'
import { RESULT_TYPE_LABELS, DIRECTION_LABELS, FIELDING_POSITIONS } from '@/lib/supabase/types'
import type { AtBat, Direction, Game, ResultType, PitchingStat } from '@/lib/supabase/types'
import DirectionChart from '@/app/(protected)/_components/DirectionChart'
import SprayChart from '@/app/(protected)/_components/SprayChart'
import { ThemeContext } from '@/app/(protected)/_components/ThemeProvider'
import StatTooltip from '@/app/(protected)/_components/StatTooltip'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

type Tab = 'season' | 'per-game' | 'log' | 'pitching' | 'direction' | 'direction2' | 'analytics'

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function avgColor(avg: number | null): string {
  if (avg === null) return 'text-accent'
  if (avg >= 0.300) return 'text-pos-t'
  if (avg >= 0.250) return 'text-neu-t'
  return 'text-neg-t'
}

function opsColor(ops: number | null): string {
  if (ops === null) return 'text-accent'
  if (ops >= 0.800) return 'text-pos-t'
  if (ops >= 0.700) return 'text-neu-t'
  return 'text-neg-t'
}

function ResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win') return <span className="text-xs px-1.5 py-0.5 rounded bg-pos text-pos-t font-bold">勝</span>
  if (result === 'loss') return <span className="text-xs px-1.5 py-0.5 rounded bg-neg text-neg-t font-bold">負</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-neu text-neu-t font-bold">分</span>
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-accent">{value}</div>
      <div className="text-xs text-sub2 mt-0.5">{label}</div>
    </div>
  )
}

// 2カラムリスト形式の1行（左右それぞれラベル+値）
function StatRow({ left, right }: {
  left: { label: React.ReactNode; value: string | number }
  right?: { label: React.ReactNode; value: string | number }
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-s2 odd:bg-lv1 even:bg-lv2 dark:odd:bg-lv1 dark:even:bg-lv2">
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="text-sm text-sub1">{left.label}</span>
        <span className="text-xl font-bold text-accent">{left.value}</span>
      </div>
      {right ? (
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-sm text-sub1">{right.label}</span>
          <span className="text-xl font-bold text-accent">{right.value}</span>
        </div>
      ) : (
        <div />
      )}
    </div>
  )
}

const TAB_LIST: { key: Tab; label: string }[] = [
  { key: 'season',    label: 'シーズン累計' },
  { key: 'per-game',  label: '試合別' },
  { key: 'log',       label: '打席ログ' },
  { key: 'pitching',  label: '投手成績' },
  { key: 'direction',  label: '打球方向' },
  { key: 'direction2', label: 'スプレー' },
  { key: 'analytics',  label: '分析' },
]

export default function StatsPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const { theme } = useContext(ThemeContext)
  const currentYear = new Date().getFullYear()
  const [season, setSeason] = useState<number | 'all'>(currentYear)
  const [games, setGames] = useState<GameWithAtBats[]>([])
  const [pitchingStats, setPitchingStats] = useState<PitchingStat[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('season')
  const [tabVisible, setTabVisible] = useState(true)
  const [copiedFlash, setCopiedFlash] = useState(false)
  const [csvFlash, setCsvFlash] = useState(false)
  const [logFilter, setLogFilter] = useState<ResultType | 'all'>('all')
  // M7-2: 対戦相手検索フィルター
  const [opponentSearch, setOpponentSearch] = useState('')

  // M-1: スワイプ検出用 ref
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  // M7-3: タブ切り替え時のスクロール位置保存
  const scrollPositions = useRef<Record<string, number>>({})

  // P-2: シーズンごとのクライアントキャッシュ（タブ切り替え時のチラつき防止）
  const cacheRef = useRef<Map<number | 'all', { games: GameWithAtBats[]; pitchingStats: PitchingStat[] }>>(new Map())

  // sessionStorage からタブ・シーズンを復元（SSR対策: useEffect で実行）
  useEffect(() => {
    const saved = sessionStorage.getItem('baseball_stats_tab')
    const validTabs: Tab[] = ['season', 'per-game', 'log', 'pitching', 'direction', 'direction2', 'analytics']
    if (saved && validTabs.includes(saved as Tab)) {
      setTab(saved as Tab)
    }
    // 通算選択も復元する
    const savedSeason = sessionStorage.getItem('baseball_stats_season')
    if (savedSeason === 'all') {
      setSeason('all')
    } else if (savedSeason) {
      const parsed = parseInt(savedSeason)
      if (!isNaN(parsed)) setSeason(parsed)
    }
  }, [])

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // M7-5: タブに応じてドキュメントタイトルを更新
  const TAB_TITLES: Record<Tab, string> = {
    'season':    'シーズン累計',
    'per-game':  '試合別成績',
    'log':       '打席ログ',
    'pitching':  '投手成績',
    'direction':  '打球方向',
    'direction2': 'スプレーチャート',
    'analytics':  '分析',
  }
  useEffect(() => {
    document.title = `${TAB_TITLES[tab]} | 草野球記録`
    return () => { document.title = '草野球記録' }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    const fetchData = async () => {
      // P-2: キャッシュヒット時はネットワーク取得をスキップ
      const cached = cacheRef.current.get(season)
      if (cached) {
        setGames(cached.games)
        setPitchingStats(cached.pitchingStats)
        setLoading(false)
        return
      }

      setLoading(true)

      // 通算の場合は season フィルタなし
      const [{ data }, { data: ps }] = season === 'all'
        ? await Promise.all([
            supabase.from('games').select('*, at_bats(*)').order('game_date', { ascending: false }),
            supabase.from('pitching_stats').select('*'),
          ])
        : await Promise.all([
            supabase.from('games').select('*, at_bats(*)').eq('season', season).order('game_date', { ascending: false }),
            supabase.from('pitching_stats').select('*, games!inner(season)').eq('games.season', season),
          ])
      const gamesData = (data ?? []) as GameWithAtBats[]
      const psData = (ps ?? []) as PitchingStat[]
      setGames(gamesData)
      setPitchingStats(psData)
      cacheRef.current.set(season, { games: gamesData, pitchingStats: psData })
      setLoading(false)
    }
    fetchData()
  }, [supabase, season])

  // M-1: スワイプでタブ遷移（縦スクロール競合防止）
  const SWIPE_TABS: Tab[] = ['season', 'per-game', 'log', 'pitching', 'direction', 'direction2', 'analytics']
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // 縦方向が横方向より大きい場合はスクロールとみなしてスキップ
    if (Math.abs(deltaY) > Math.abs(deltaX)) return
    const currentIndex = SWIPE_TABS.indexOf(tab)
    if (deltaX < -50 && currentIndex < SWIPE_TABS.length - 1) handleTabChange(SWIPE_TABS[currentIndex + 1])
    if (deltaX > 50 && currentIndex > 0) handleTabChange(SWIPE_TABS[currentIndex - 1])
  }

  const handleSeasonChange = (val: number | 'all') => {
    setSeason(val)
    sessionStorage.setItem('baseball_stats_season', String(val))
  }

  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return
    // M7-3: 現在のスクロール位置を保存してからタブ切り替え
    scrollPositions.current[tab] = window.scrollY
    sessionStorage.setItem('baseball_stats_tab', newTab)
    setTabVisible(false)
    setTab(newTab)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // M7-3: 新タブの前回スクロール位置を復元（初回は0）
        window.scrollTo({ top: scrollPositions.current[newTab] ?? 0, behavior: 'instant' })
        setTabVisible(true)
      })
    })
  }

  const allAtBats = games.flatMap((g) => g.at_bats)
  const stats = calcBattingStats(allAtBats)
  const pStats = calcPitchingStats(pitchingStats)

  const wins = games.filter((g) => g.result === 'win').length
  const losses = games.filter((g) => g.result === 'loss').length
  const draws = games.filter((g) => g.result === 'draw').length
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, '') : '---'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">成績</h1>
        <select
          value={season}
          onChange={(e) => handleSeasonChange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
          className="border border-s2 rounded-lg px-3 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme transition-shadow duration-150"
        >
          <option value="all">通算</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
      </div>

      {/* R-6: 二重タブ実装（PC=hidden lg:block / スマホ=fixed bottom-0）を撤廃し、
            sticky top-0 z-30 の 1 つのタブに統合。R-1 グローバルナビ(z-40) と非干渉、
            ページ内タブはサブナビとして上部 sticky にする方針（標準パターン）。 */}
      <div className="sticky top-0 z-30 bg-lv2 border-b border-s2 -mx-4 px-4">
        <div className="flex overflow-x-auto max-w-5xl mx-auto">
          {TAB_LIST.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px outline-none transition-colors duration-150 ${
                tab === key
                  ? 'text-theme border-theme'
                  : 'text-sub2 hover:text-main border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 min-h-[520px]">
          {[1,2,3].map(i => (
            <div key={i} className="bg-lv1 rounded-xl border border-s2 p-6 animate-pulse">
              <div className="h-4 bg-lv2 rounded w-1/4 mb-4" />
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(j => <div key={j} className="h-10 bg-lv2 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="space-y-4 min-h-[520px]"
          style={{
            opacity: tabVisible ? 1 : 0,
            transition: tabVisible ? 'opacity 0.14s ease-out' : 'none',
            overflowAnchor: 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >

          {/* タブ1: シーズン累計 */}
          {tab === 'season' && (
            <div className="space-y-4">
              {games.length > 0 && (
                <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-5">
                  <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">チーム戦績</h2>
                  <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xl font-bold text-accent">{games.length}</div>
                      <div className="text-xs text-sub2 mt-0.5">試合</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-accent">{wins}</div>
                      <div className="text-xs text-sub2 mt-0.5">勝</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-accent">{losses}</div>
                      <div className="text-xs text-sub2 mt-0.5">負</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-accent">{draws}</div>
                      <div className="text-xs text-sub2 mt-0.5">分</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-accent">{winRate}</div>
                      <div className="text-xs text-sub2 mt-0.5">勝率</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-lv1 rounded-xl shadow-sm border border-s2 overflow-hidden">
                <div className="px-5 py-4 border-b border-s2">
                  <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">打撃成績</h2>
                </div>
                {allAtBats.length === 0 ? (
                  <p className="text-sub2 text-center py-8">まだ打席記録がありません</p>
                ) : (
                  <>
                    {/* 主要指標ハイライト */}
                    <div className="grid grid-cols-4 divide-x divide-s2 border-b border-s2">
                      {[
                        { label: '打率', value: fmtAvg(stats.avg), colorClass: avgColor(stats.avg) },
                        { label: '出塁率', value: fmtAvg(stats.obp), colorClass: 'text-accent' },
                        { label: '長打率', value: fmtAvg(stats.slg), colorClass: 'text-accent' },
                        { label: 'OPS', value: fmtDec(stats.ops, 3).replace(/^0/, ''), colorClass: opsColor(stats.ops) },
                      ].map(({ label, value, colorClass }) => (
                        <div key={label} className="flex flex-col items-center py-4 px-2">
                          <span className="text-xs text-sub2 mb-1">
                            <StatTooltip label={label} />
                          </span>
                          <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {/* 詳細成績 2カラムリスト */}
                    <div className="divide-y divide-s2">
                      <StatRow left={{ label: '打席', value: stats.pa }}        right={{ label: '打数', value: stats.ab }} />
                      <StatRow left={{ label: '安打', value: stats.hits }}      right={{ label: '本塁打', value: stats.hrs }} />
                      <StatRow left={{ label: '二塁打', value: stats.doubles }} right={{ label: '三塁打', value: stats.triples }} />
                      <StatRow left={{ label: '打点', value: stats.rbi }}       right={{ label: '得点', value: stats.runs }} />
                      <StatRow left={{ label: '盗塁', value: stats.sb }}        right={{ label: '盗塁死', value: stats.cs }} />
                      <StatRow left={{ label: '三振', value: stats.strikeouts }} right={{ label: '四球', value: stats.walks }} />
                      <StatRow left={{ label: '死球', value: stats.hbp }}       right={{ label: '犠打', value: stats.sac_bunt }} />
                      <StatRow left={{ label: '犠飛', value: stats.sac_fly }}   right={{ label: <StatTooltip label="RC27" />, value: fmtDec(stats.rc27, 2) }} />
                      <StatRow left={{ label: <StatTooltip label="IsoD" />, value: fmtAvg(stats.isod) }} right={{ label: <StatTooltip label="IsoP" />, value: fmtAvg(stats.isop) }} />
                    </div>
                    {/* L6-2: CSVエクスポート + L6-6: 成績コピー（テーマ名付き） */}
                    <div className="px-5 py-3 border-t border-s2 flex justify-end gap-2">
                      {/* L6-2: CSV ダウンロード */}
                      <button
                        type="button"
                        onClick={() => {
                          const headers = ['日付', '対戦相手', '打順', '結果', 'RBI', '方向', '最終カウント']
                          const rows = games.flatMap(g =>
                            g.at_bats.map(ab => [
                              g.game_date,
                              g.opponent,
                              ab.batting_order,
                              RESULT_TYPE_LABELS[ab.result_type] ?? ab.result_type,
                              ab.rbi_count ?? 0,
                              ab.direction ? (DIRECTION_LABELS[ab.direction] ?? ab.direction) : '',
                              ab.count_balls !== null && ab.count_strikes !== null
                                ? `${ab.count_balls}B-${ab.count_strikes}S`
                                : '',
                            ])
                          )
                          const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
                          const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `batting_stats_${season}.csv`
                          a.click()
                          URL.revokeObjectURL(url)
                          setCsvFlash(true)
                          setTimeout(() => setCsvFlash(false), 1500)
                        }}
                        className="text-xs text-sub2 hover:text-theme border border-s2 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        ⬇ CSV
                      </button>
                      {/* L6-6: 成績コピー（テーマ名・ハッシュタグ付き） */}
                      <button
                        type="button"
                        onClick={() => {
                          const label = season === 'all' ? '通算' : `${season}年`
                          const prefix = theme === 'abema' ? '📺' : '⚾'
                          const themeLine = theme === 'abema' ? ' #ABEMA' : ''
                          const text = `${prefix}【${label}シーズン成績】\n打率 ${fmtAvg(stats.avg)} / OPS ${fmtDec(stats.ops, 3).replace(/^0/, '')}\n${stats.hits}安打 ${stats.hrs}本塁打 ${stats.rbi}打点\n#草野球 #baseball${themeLine}`
                          navigator.clipboard.writeText(text).then(() => {
                            setCopiedFlash(true)
                            setTimeout(() => setCopiedFlash(false), 800)
                          })
                        }}
                        className="text-xs text-sub2 hover:text-theme border border-s2 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        📋 コピー
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* タブ2: 試合別 */}
          {tab === 'per-game' && (() => {
            return (
            <div className="space-y-4">
              <div className="bg-lv1 rounded-xl shadow-sm border border-s2 overflow-hidden">
              {games.length === 0 ? (
                <div className="p-12 text-center text-sub2">試合データがありません</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-lv2 text-sub2 text-xs">
                        <th className="text-left px-4 py-3 font-medium">日付</th>
                        <th className="text-left px-4 py-3 font-medium">相手</th>
                        <th className="px-3 py-3 font-medium">勝敗</th>
                        <th className="px-3 py-3 font-medium">打席</th>
                        <th className="px-3 py-3 font-medium">打数</th>
                        <th className="px-3 py-3 font-medium">安打</th>
                        <th className="px-3 py-3 font-medium">打率</th>
                        <th className="px-3 py-3 font-medium">打点</th>
                        <th className="px-3 py-3 font-medium">盗塁</th>
                        <th className="px-3 py-3 font-medium">三振</th>
                        <th className="px-3 py-3 font-medium">四死球</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-s2">
                      {games.map((game) => {
                        const gs = calcBattingStats(game.at_bats)
                        return (
                          <tr key={game.id} className="hover:bg-lv2 dark:hover:bg-lv1 transition-colors duration-100">
                            <td className="px-4 py-3 text-sub1">{formatDate(game.game_date)}</td>
                            <td className="px-4 py-3 font-medium text-main">{game.opponent}</td>
                            <td className="px-3 py-3 text-center"><ResultBadge result={game.result} /></td>
                            <td className="px-3 py-3 text-center text-main">{gs.pa}</td>
                            <td className="px-3 py-3 text-center text-main">{gs.ab}</td>
                            <td className="px-3 py-3 text-center text-main">{gs.hits}</td>
                            <td className={`px-3 py-3 text-center font-medium ${avgColor(gs.avg)}`}>{fmtAvg(gs.avg)}</td>
                            <td className="px-3 py-3 text-center text-main">{gs.rbi}</td>
                            <td className="px-3 py-3 text-center text-main">{gs.sb}</td>
                            <td className="px-3 py-3 text-center text-main">{gs.strikeouts}</td>
                            <td className="px-3 py-3 text-center text-main">{gs.walks + gs.hbp}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
            </div>
            )
          })()}

          {/* タブ3: 打席ログ（試合別タイムライン） */}
          {tab === 'log' && (
            <div className="space-y-3">
              {/* M7-2: 対戦相手検索フィルター */}
              {games.length > 0 && (
                <input
                  type="search"
                  placeholder="対戦相手で絞り込み..."
                  value={opponentSearch}
                  onChange={(e) => setOpponentSearch(e.target.value)}
                  className="w-full border border-s2 rounded-lg px-3 py-1.5 text-sm bg-lv1 text-main placeholder:text-sub2 focus:outline-none focus:ring-2 focus:ring-theme transition-shadow duration-150"
                />
              )}
              {/* M-4: ログフィルタ */}
              {allAtBats.length > 0 && (() => {
                const LOG_FILTERS: { value: ResultType | 'all'; label: string }[] = [
                  { value: 'all',       label: '全部' },
                  { value: 'hit',       label: '安打' },
                  { value: 'double',    label: '二塁打' },
                  { value: 'triple',    label: '三塁打' },
                  { value: 'hr',        label: '本塁打' },
                  { value: 'strikeout', label: '三振' },
                  { value: 'walk',      label: '四球' },
                  { value: 'hbp',       label: '死球' },
                ]
                return (
                  <div className="flex gap-1.5 flex-wrap">
                    {LOG_FILTERS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setLogFilter(value)}
                        className={`px-3 py-1 text-xs rounded-lg border font-medium transition-colors ${
                          logFilter === value
                            ? 'bg-theme text-white border-theme'
                            : 'bg-lv1 border-s2 text-sub2 hover:text-main'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )
              })()}
              {allAtBats.length === 0 ? (
                <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-12 text-center text-sub2">
                  打席データがありません
                </div>
              ) : (
                games
                  // M7-2: 対戦相手名でフィルタ
                  .filter(g => !opponentSearch || g.opponent?.toLowerCase().includes(opponentSearch.toLowerCase()))
                  .map((game) => {
                  const sorted = [...game.at_bats]
                    .filter(ab => logFilter === 'all' || ab.result_type === logFilter)
                    .sort((a, b) => a.at_bat_number - b.at_bat_number)
                  if (sorted.length === 0 && logFilter !== 'all') return null
                  if (sorted.length === 0) return null
                  return (
                    <div key={game.id} className="bg-lv1 rounded-xl shadow-sm border border-s2 p-4">
                      {/* 試合ヘッダー */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-main">{formatDate(game.game_date)} vs {game.opponent}</span>
                        <ResultBadge result={game.result} />
                        <span className="text-xs text-sub2 ml-auto">{sorted.length}打席</span>
                      </div>
                      {/* 打席バッジ横並び */}
                      <div className="flex flex-wrap gap-2">
                        {sorted.map((ab) => {
                          const isHit = ['hit', 'double', 'triple', 'hr'].includes(ab.result_type)
                          const isK = ab.result_type === 'strikeout'
                          const isWalk = ['walk', 'hbp'].includes(ab.result_type)
                          const badgeClass = isHit
                            ? 'bg-pos text-pos-t'
                            : isK
                            ? 'bg-neg text-neg-t'
                            : isWalk
                            ? 'bg-theme/15 text-theme'
                            : 'bg-lv2 text-sub1'
                          const label = RESULT_TYPE_LABELS[ab.result_type as ResultType] ?? ab.result_type
                          const rbiVal = ab.rbi_count ?? (ab.is_rbi ? 1 : 0)
                          const sbVal = ab.stolen_base_count ?? (ab.is_stolen_base ? 1 : 0)
                          return (
                            <div key={ab.id} className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] text-sub2">{ab.at_bat_number}</span>
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${badgeClass}`}>
                                {label}
                              </span>
                              {(rbiVal > 0 || sbVal > 0 || ab.is_run) && (
                                <span className="text-[10px] text-sub2">
                                  {rbiVal > 0 && `打${rbiVal}`}
                                  {sbVal > 0 && `盗${sbVal}`}
                                  {ab.is_run && '得'}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* タブ4: 投手成績 */}
          {tab === 'pitching' && (
            <div className="space-y-4">
              {pitchingStats.length === 0 ? (
                <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-12 text-center text-sub2">
                  投手成績が登録されていません
                </div>
              ) : (
                <>
                  <div className="bg-lv1 rounded-xl shadow-sm border border-s2 overflow-hidden">
                    <div className="px-5 py-4 border-b border-s2">
                      {/* H8-4: 「シーズン投手成績」→「投手成績」（通算切替対応） */}
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">投手成績</h2>
                    </div>
                    {/* 主要指標ハイライト（H8-2: ⓘ ツールチップ付き） */}
                    <div className="grid grid-cols-4 divide-x divide-s2 border-b border-s2">
                      {[
                        { label: '防御率', value: fmtERA(pStats.era) },
                        { label: 'WHIP', value: fmtDec(pStats.whip, 2) },
                        { label: 'K/9', value: fmtDec(pStats.k9, 1) },
                        { label: 'K/BB', value: fmtDec(pStats.kbb, 2) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center py-4 px-2">
                          <span className="text-xs text-sub2 mb-1">
                            <StatTooltip label={label} />
                          </span>
                          <span className="text-2xl font-bold text-accent">{value}</span>
                        </div>
                      ))}
                    </div>
                    {/* 詳細成績 2カラムリスト（H8-2/H8-3: ⓘ 付き・被打率/WHIP/K/BB 追加） */}
                    <div className="divide-y divide-s2">
                      <StatRow left={{ label: '登板', value: pStats.games }}          right={{ label: '投球回', value: formatIP(pStats.innings_pitched) }} />
                      <StatRow left={{ label: '勝', value: pStats.wins }}             right={{ label: '敗', value: pStats.losses }} />
                      <StatRow left={{ label: 'セーブ', value: pStats.saves }}        right={{ label: 'ホールド', value: pStats.holds }} />
                      <StatRow left={{ label: '完投', value: pStats.complete_games }} right={{ label: '被安打', value: pStats.hits_allowed }} />
                      <StatRow left={{ label: '被本塁打', value: pStats.home_runs_allowed }} right={{ label: '奪三振', value: pStats.strikeouts }} />
                      <StatRow left={{ label: '与四球', value: pStats.walks }}        right={{ label: '与死球', value: pStats.hit_batsmen }} />
                      <StatRow left={{ label: '失点', value: pStats.runs_allowed }}   right={{ label: '自責点', value: pStats.earned_runs }} />
                      <StatRow
                        left={{ label: <StatTooltip label="FIP" />, value: fmtDec(pStats.fip, 2) }}
                        right={{ label: <StatTooltip label="被打率" />, value: fmtAvg(pStats.baa) }}
                      />
                      <StatRow
                        left={{ label: <StatTooltip label="WHIP" />, value: fmtDec(pStats.whip, 2) }}
                        right={{ label: <StatTooltip label="K/BB" />, value: fmtDec(pStats.kbb, 2) }}
                      />
                      {pStats.pitch_count !== null && (
                        <StatRow
                          left={{ label: <StatTooltip label="K/9" />, value: fmtDec(pStats.k9, 1) }}
                          right={{ label: '総投球数', value: pStats.pitch_count }}
                        />
                      )}
                      {pStats.pitch_count === null && (
                        <StatRow left={{ label: <StatTooltip label="K/9" />, value: fmtDec(pStats.k9, 1) }} />
                      )}
                    </div>
                    {/* H8-5: CSV / シェアコピー（投手成績） */}
                    <div className="px-5 py-3 border-t border-s2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const headers = ['日付', '対戦相手', '結果', '投球回', '被安打', '被本塁打', '奪三振', '与四球', '与死球', '失点', '自責点', '投球数', '完投']
                          const resultLabels: Record<string, string> = { win: '勝', loss: '敗', save: 'S', hold: 'H', none: '-' }
                          const rows = pitchingStats.map(ps => {
                            const g = games.find(gm => gm.id === ps.game_id)
                            return [
                              g?.game_date ?? '',
                              g?.opponent ?? '',
                              resultLabels[ps.result] ?? '-',
                              formatIP(ps.innings_pitched),
                              ps.hits_allowed,
                              ps.home_runs_allowed,
                              ps.strikeouts,
                              ps.walks,
                              ps.hit_batsmen,
                              ps.runs_allowed,
                              ps.earned_runs,
                              ps.pitch_count ?? '',
                              ps.complete_game ? '○' : '',
                            ]
                          })
                          const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
                          const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `pitching_stats_${season}.csv`
                          a.click()
                          URL.revokeObjectURL(url)
                          setCsvFlash(true)
                          setTimeout(() => setCsvFlash(false), 1500)
                        }}
                        className="text-xs text-sub2 hover:text-theme border border-s2 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        ⬇ CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const label = season === 'all' ? '通算' : `${season}年`
                          const prefix = theme === 'abema' ? '📺' : '⚾'
                          const themeLine = theme === 'abema' ? ' #ABEMA' : ''
                          const text = `${prefix}【${label} 投手成績】\n防御率 ${fmtERA(pStats.era)} / WHIP ${fmtDec(pStats.whip, 2)} / K/9 ${fmtDec(pStats.k9, 1)}\n${pStats.games}登板 ${pStats.wins}勝${pStats.losses}敗 ${formatIP(pStats.innings_pitched)}回 ${pStats.strikeouts}奪三振\n#草野球 #baseball${themeLine}`
                          navigator.clipboard.writeText(text).then(() => {
                            setCopiedFlash(true)
                            setTimeout(() => setCopiedFlash(false), 800)
                          })
                        }}
                        className="text-xs text-sub2 hover:text-theme border border-s2 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        📋 コピー
                      </button>
                    </div>
                  </div>

                  <div className="bg-lv1 rounded-xl shadow-sm border border-s2 overflow-hidden">
                    <div className="px-5 py-3 border-b border-s2">
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">試合別投手成績</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-lv2 text-sub2 text-xs">
                            <th className="text-left px-4 py-3 font-medium">日付</th>
                            <th className="text-left px-4 py-3 font-medium">相手</th>
                            <th className="px-3 py-3 font-medium">結果</th>
                            <th className="px-3 py-3 font-medium">投球回</th>
                            <th className="px-3 py-3 font-medium">被安</th>
                            <th className="px-3 py-3 font-medium">K</th>
                            <th className="px-3 py-3 font-medium">BB</th>
                            <th className="px-3 py-3 font-medium">失点</th>
                            <th className="px-3 py-3 font-medium">自責</th>
                            <th className="px-3 py-3 font-medium">防御率</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-s2">
                          {games.map((game) => {
                            const ps = pitchingStats.find(p => p.game_id === game.id)
                            if (!ps) return null
                            const resultLabels: Record<string, string> = { win: '勝', loss: '敗', save: 'S', hold: 'H', none: '-' }
                            const resultColors: Record<string, string> = {
                              win: 'text-pos-t font-bold', loss: 'text-neg-t font-bold',
                              save: 'text-pos-t font-bold', hold: 'text-theme font-bold', none: 'text-sub2'
                            }
                            return (
                              <tr key={game.id} className="hover:bg-lv2 dark:hover:bg-lv1 transition-colors duration-100">
                                <td className="px-4 py-3 text-sub1">{formatDate(game.game_date)}</td>
                                <td className="px-4 py-3 font-medium text-main">{game.opponent}</td>
                                <td className={`px-3 py-3 text-center ${resultColors[ps.result]}`}>{resultLabels[ps.result]}</td>
                                <td className="px-3 py-3 text-center text-main">{formatIP(ps.innings_pitched)}</td>
                                <td className="px-3 py-3 text-center text-main">{ps.hits_allowed}</td>
                                <td className="px-3 py-3 text-center text-main">{ps.strikeouts}</td>
                                <td className="px-3 py-3 text-center text-main">{ps.walks}</td>
                                <td className="px-3 py-3 text-center text-main">{ps.runs_allowed}</td>
                                <td className="px-3 py-3 text-center text-main">{ps.earned_runs}</td>
                                {/* M8-4: 単試合防御率 */}
                                <td className="px-3 py-3 text-center text-main whitespace-nowrap">
                                  {ps.innings_pitched > 0
                                    ? fmtERA((ps.earned_runs * 21) / ps.innings_pitched)
                                    : '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* タブ5: 打球方向 */}
          {tab === 'direction' && (
            allAtBats.length === 0 ? (
              <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-12 text-center text-sub2">
                打席データがありません
              </div>
            ) : (
              <DirectionChart atBats={allAtBats} />
            )
          )}

          {/* タブ5-2: スプレーチャート（direction2） */}
          {tab === 'direction2' && (
            games.length === 0 ? (
              <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-12 text-center text-sub2 text-sm">
                試合データがありません
              </div>
            ) : (
              <SprayChart games={games} />
            )
          )}

          {/* タブ6: 分析 */}
          {tab === 'analytics' && (() => {
            const card = 'bg-lv1 rounded-xl shadow-sm border border-s2'

            // 1. 安打種別データ
            const hitTypeData = [
              { name: '単打', value: stats.hits - stats.doubles - stats.triples - stats.hrs },
              { name: '二塁打', value: stats.doubles },
              { name: '三塁打', value: stats.triples },
              { name: '本塁打', value: stats.hrs },
            ].filter(d => d.value > 0)
            const HIT_COLORS = ['var(--theme)', '#60a5fa', '#f97316', 'var(--pos_text)']

            // 2. 試合別 RBI/HR データ（古い順）
            const sortedGames = [...games].sort((a, b) => a.game_date.localeCompare(b.game_date))

            // CH-1: 打率推移データ（累積 + 単試合）
            const avgChartData = sortedGames.reduce((acc, game) => {
              const prev = acc[acc.length - 1]
              const gStats = calcBattingStats(game.at_bats)
              const cumAB = (prev?.cumAB ?? 0) + gStats.ab
              const cumHits = (prev?.cumHits ?? 0) + gStats.hits
              return [...acc, {
                date: `${parseInt(game.game_date.split('-')[1])}/${parseInt(game.game_date.split('-')[2])}`,
                cumAvg: cumAB > 0 ? cumHits / cumAB : null,
                gameAvg: gStats.ab > 0 ? gStats.hits / gStats.ab : null,
                cumAB, cumHits,
                ab: gStats.ab, hits: gStats.hits,
              }]
            }, [] as any[])

            const rbiHrData = sortedGames.map((g) => {
              const gs = calcBattingStats(g.at_bats)
              return { date: formatDate(g.game_date), rbi: gs.rbi, hr: gs.hrs }
            })

            // 3. 勝敗別打率
            const winGames = games.filter(g => g.result === 'win')
            const lossGames = games.filter(g => g.result === 'loss')
            const winStats = calcBattingStats(winGames.flatMap(g => g.at_bats))
            const lossStats = calcBattingStats(lossGames.flatMap(g => g.at_bats))

            // 4. OPS 推移データ（累積 + 単試合）
            const opsData = sortedGames.map((game, idx) => {
              const cumStats = calcBattingStats(sortedGames.slice(0, idx + 1).flatMap(g => g.at_bats))
              const gameStats = calcBattingStats(game.at_bats)
              return {
                date: formatDate(game.game_date),
                cumOps: parseFloat((cumStats.ops ?? 0).toFixed(3)),
                gameOps: parseFloat((gameStats.ops ?? 0).toFixed(3)),
              }
            })

            // 5. ERA トレンドデータ
            const sortedPitching = [...pitchingStats].sort((a, b) => {
              const ga = games.find(g => g.id === a.game_id)
              const gb = games.find(g => g.id === b.game_id)
              return (ga?.game_date ?? '').localeCompare(gb?.game_date ?? '')
            })
            const eraData = sortedPitching.reduce((acc, ps) => {
              const prev = acc[acc.length - 1]
              const totalER = (prev?.totalER ?? 0) + ps.earned_runs
              const totalIP = (prev?.totalIP ?? 0) + ps.innings_pitched
              const era = totalIP > 0 ? parseFloat(((totalER * 21) / totalIP).toFixed(2)) : 0
              const gameEra = ps.innings_pitched > 0
                ? parseFloat(((ps.earned_runs * 21) / ps.innings_pitched).toFixed(2))
                : null
              const g = games.find(gm => gm.id === ps.game_id)
              return [...acc, { date: g ? formatDate(g.game_date) : '', era, gameEra, totalER, totalIP }]
            }, [] as { date: string; era: number; gameEra: number | null; totalER: number; totalIP: number }[])

            return (
              <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">

                {/* 1. 安打種別ドーナツ */}
                {stats.hits > 0 && (
                  <div className={`${card} p-5`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">安打種別</h2>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={hitTypeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            dataKey="value"
                          >
                            {hitTypeData.map((entry, index) => (
                              <Cell key={entry.name} fill={HIT_COLORS[index]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string) => [`${value}本`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-accent">{stats.hits}</span>
                        <span className="text-xs text-sub2">安打</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center mt-2">
                      {hitTypeData.map((entry, i) => (
                        <span key={entry.name} className="flex items-center gap-1 text-xs text-sub1">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: HIT_COLORS[i] }} />
                          {entry.name}: {entry.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CH-1: 打率推移 — 安打種別の直後・PC全幅 */}
                {sortedGames.length >= 3 && (
                  <div className={`${card} p-5 lg:col-span-2`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">打率推移</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={avgChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <YAxis
                          tickFormatter={(v) => fmtAvg(v)}
                          tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }}
                          domain={[0, 1]}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const cum = payload.find(p => p.dataKey === 'cumAvg')
                            const game = payload.find(p => p.dataKey === 'gameAvg')
                            const gameEntry = avgChartData.find((d: any) => d.date === label)
                            return (
                              <div className="bg-lv1 border border-s2 rounded-lg px-3 py-2 text-xs shadow-sm">
                                <div className="font-semibold text-main mb-1">{label}</div>
                                {cum?.value != null && <div className="text-sub1">累積 {fmtAvg(cum.value as number)}</div>}
                                {game?.value != null && gameEntry && (
                                  <div className="text-sub2">単試合 {fmtAvg(game.value as number)}（{gameEntry.ab}打数{gameEntry.hits}安打）</div>
                                )}
                              </div>
                            )
                          }}
                        />
                        <Line type="monotone" dataKey="cumAvg" stroke="var(--theme)" strokeWidth={2}
                          dot={{ r: 3, fill: 'var(--theme)' }} connectNulls />
                        <Line type="monotone" dataKey="gameAvg" stroke="var(--sub_text_lv2)" strokeWidth={1.5}
                          strokeDasharray="4 2" dot={{ r: 2, fill: 'var(--sub_text_lv2)' }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-sub2 text-right mt-1">実線: 累積打率　破線: 単試合打率</p>
                  </div>
                )}

                {/* CH-2: OPS 推移 — PC全幅 */}
                {sortedGames.length >= 2 && (
                  <div className={`${card} p-5 lg:col-span-2`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">OPS 推移</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={opsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <YAxis
                          domain={[0, 1.4]}
                          tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }}
                          tickFormatter={(v: number) => v.toFixed(1)}
                        />
                        <Tooltip formatter={(v: number, name: string) => [
                          fmtDec(v, 3).replace(/^0/, ''),
                          name === 'cumOps' ? '累積OPS' : '単試合OPS',
                        ]} />
                        <Line type="monotone" dataKey="cumOps" stroke="var(--theme)" strokeWidth={2}
                          dot={{ r: 3, fill: 'var(--theme)' }} name="cumOps" />
                        <Line type="monotone" dataKey="gameOps" stroke="var(--sub_text_lv1)" strokeWidth={1}
                          dot={false} strokeDasharray="4 2" name="gameOps" />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-sub2 text-right mt-1">実線: 累積OPS　破線: 単試合OPS</p>
                  </div>
                )}

                {/* 2. 試合別 RBI / HR */}
                {sortedGames.length >= 3 && (
                  <div className={`${card} p-5`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">試合別 RBI / HR</h2>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={rbiHrData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <Tooltip />
                        <Bar dataKey="rbi" name="打点" fill="var(--theme)" />
                        <Bar dataKey="hr" name="HR" fill="#f97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 3. 勝敗別打率比較 */}
                <div className={`${card} p-5`}>
                  <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">勝敗別打率</h2>
                  {winGames.length === 0 && lossGames.length === 0 ? (
                    <p className="text-sub2 text-sm text-center py-4">データなし</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-lv2 rounded-lg p-4 text-center">
                        <div className="text-xs text-sub2 mb-1">勝ち（{winGames.length}試合）</div>
                        <div className="text-2xl font-bold text-pos-t">{fmtAvg(winStats.avg)}</div>
                        <div className="text-xs text-sub2 mt-1">打率</div>
                      </div>
                      <div className="bg-lv2 rounded-lg p-4 text-center">
                        <div className="text-xs text-sub2 mb-1">負け（{lossGames.length}試合）</div>
                        <div className="text-2xl font-bold text-neg-t">{fmtAvg(lossStats.avg)}</div>
                        <div className="text-xs text-sub2 mt-1">打率</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. ERA 推移（累積実線 + 単試合破線） */}
                {pitchingStats.length > 0 && (
                  <div className={`${card} p-5`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">防御率推移</h2>
                    {pitchingStats.length < 3 ? (
                      <p className="text-sub2 text-sm text-center py-4">登板数が増えると表示されます</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={eraData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke_lv2)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                          <Tooltip
                            formatter={(v: number, name: string) => [
                              fmtERA(v),
                              name === 'era' ? '累積防御率' : '単試合防御率',
                            ]}
                          />
                          <Legend
                            formatter={(value) => value === 'era' ? '累積（実線）' : '単試合（破線）'}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="era"
                            stroke="var(--theme)"
                            strokeWidth={2}
                            dot={{ r: 3, fill: 'var(--theme)' }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="gameEra"
                            stroke="var(--accent)"
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            dot={{ r: 2, fill: 'var(--accent)' }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}

                {/* 6. 打順別成績 (B-1) */}
                {(() => {
                  const orders = [1,2,3,4,5,6,7,8,9]
                  const rows = orders.map(order => {
                    const abs = allAtBats.filter(ab => ab.batting_order === order)
                    if (abs.length === 0) return null
                    const s = calcBattingStats(abs)
                    return { order, pa: s.pa, ab: s.ab, hits: s.hits, hrs: s.hrs, rbi: s.rbi, avg: s.avg }
                  }).filter(Boolean)
                  if (rows.length === 0) return null
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">打順別成績</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">打順</th>
                              <th className="px-2 py-2">打席</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                              <th className="px-2 py-2">打点</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {rows.map(row => (
                              <tr key={row!.order} className="text-center">
                                <td className="text-left py-2 font-medium text-main">{row!.order}番</td>
                                <td className="px-2 py-2 text-sub1">{row!.pa}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(row!.avg)}`}>{fmtAvg(row!.avg)}</td>
                                <td className="px-2 py-2 text-main">{row!.hits}</td>
                                <td className="px-2 py-2 text-main">{row!.hrs}</td>
                                <td className="px-2 py-2 text-main">{row!.rbi}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 7. 対戦相手別成績 (B-2 / L7-1: PA + RBI 追加 → table 形式) */}
                {(() => {
                  const opponents = [...new Set(games.map(g => g.opponent))]
                  if (opponents.length < 2) return null
                  const rows = opponents.map(opp => {
                    const oppGames = games.filter(g => g.opponent === opp)
                    const oppABs = oppGames.flatMap(g => g.at_bats)
                    const s = calcBattingStats(oppABs)
                    const oppWins = oppGames.filter(g => g.result === 'win').length
                    return { opp, games: oppGames.length, wins: oppWins, avg: s.avg, pa: s.pa, hits: s.hits, hrs: s.hrs, rbi: s.rbi }
                  }).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">対戦相手別成績</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">相手</th>
                              <th className="px-2 py-2">試合</th>
                              <th className="px-2 py-2">打席</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                              <th className="px-2 py-2">打点</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {rows.map(r => (
                              <tr key={r.opp} className="text-center">
                                <td className="text-left py-2 text-xs font-medium text-main">
                                  vs {r.opp}
                                  <span className="text-sub2 font-normal ml-1">{r.wins}勝</span>
                                </td>
                                <td className="px-2 py-2 text-sub1">{r.games}</td>
                                <td className="px-2 py-2 text-sub1">{r.pa}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(r.avg)}`}>{fmtAvg(r.avg)}</td>
                                <td className="px-2 py-2 text-main">{r.hits}</td>
                                <td className="px-2 py-2 text-main">{r.hrs > 0 ? r.hrs : '-'}</td>
                                <td className="px-2 py-2 text-main">{r.rbi}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 8. 守備位置別成績 (N-1) */}
                {(() => {
                  const posRows = FIELDING_POSITIONS.map(({ value, full }) => {
                    const posABs = allAtBats.filter(ab => ab.fielding_position === value)
                    if (posABs.length === 0) return null
                    const s = calcBattingStats(posABs)
                    return { label: full, pa: s.pa, ab: s.ab, hits: s.hits, hrs: s.hrs, avg: s.avg }
                  }).filter(Boolean)
                  if (posRows.length === 0) return null
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">守備位置別成績</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">ポジション</th>
                              <th className="px-2 py-2">打席</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {posRows.map(row => (
                              <tr key={row!.label} className="text-center">
                                <td className="text-left py-2 font-medium text-main">{row!.label}</td>
                                <td className="px-2 py-2 text-sub1">{row!.pa}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(row!.avg)}`}>{fmtAvg(row!.avg)}</td>
                                <td className="px-2 py-2 text-main">{row!.hits}</td>
                                <td className="px-2 py-2 text-main">{row!.hrs > 0 ? row!.hrs : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 9. 月別打率 (L-3) */}
                {(() => {
                  const monthMap = new Map<string, GameWithAtBats[]>()
                  for (const g of sortedGames) {
                    const [, m] = g.game_date.split('-')
                    const key = `${parseInt(m)}月`
                    if (!monthMap.has(key)) monthMap.set(key, [])
                    monthMap.get(key)!.push(g)
                  }
                  if (monthMap.size < 2) return null
                  const monthData = Array.from(monthMap.entries()).map(([month, mGames]) => {
                    const s = calcBattingStats(mGames.flatMap(g => g.at_bats))
                    return { month, avg: parseFloat((s.avg ?? 0).toFixed(3)), hits: s.hits, ab: s.ab }
                  })
                  return (
                    <div className={`${card} p-5`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">月別打率</h2>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={monthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                          <YAxis domain={[0, 0.5]} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} tickFormatter={(v: number) => v.toFixed(1)} />
                          <Tooltip formatter={(v: number, name: string) => [v.toFixed(3).replace(/^0/, ''), '打率']} />
                          <Bar dataKey="avg" fill="var(--theme)" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })()}

                {/* 10. 球場別成績 (L-3) */}
                {(() => {
                  const stadiumMap = new Map<string, GameWithAtBats[]>()
                  for (const g of games) {
                    if (!g.stadium) continue
                    if (!stadiumMap.has(g.stadium)) stadiumMap.set(g.stadium, [])
                    stadiumMap.get(g.stadium)!.push(g)
                  }
                  if (stadiumMap.size < 2) return null
                  const rows = Array.from(stadiumMap.entries())
                    .map(([stadium, sGames]) => {
                      const s = calcBattingStats(sGames.flatMap(g => g.at_bats))
                      return { stadium, games: sGames.length, avg: s.avg, hits: s.hits, hrs: s.hrs }
                    })
                    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
                    .slice(0, 5)
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">球場別成績（上位5）</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">球場</th>
                              <th className="px-2 py-2">試合</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {rows.map(r => (
                              <tr key={r.stadium} className="text-center">
                                <td className="text-left py-2 text-main text-xs">{r.stadium}</td>
                                <td className="px-2 py-2 text-sub1">{r.games}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(r.avg)}`}>{fmtAvg(r.avg)}</td>
                                <td className="px-2 py-2 text-main">{r.hits}</td>
                                <td className="px-2 py-2 text-main">{r.hrs > 0 ? r.hrs : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 11. L6-3: マルチシーズン比較（「通算」表示時のみ） */}
                {season === 'all' && (() => {
                  const seasonMap = new Map<number, GameWithAtBats[]>()
                  for (const g of games) {
                    if (!seasonMap.has(g.season)) seasonMap.set(g.season, [])
                    seasonMap.get(g.season)!.push(g)
                  }
                  if (seasonMap.size < 2) return null
                  const seasonData = Array.from(seasonMap.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([yr, sGames]) => {
                      const s = calcBattingStats(sGames.flatMap(g => g.at_bats))
                      return {
                        year: `${yr}年`,
                        avg: s.avg != null ? parseFloat(s.avg.toFixed(3)) : 0,
                        ops: s.ops != null ? parseFloat(s.ops.toFixed(3)) : 0,
                        games: sGames.length,
                        hits: s.hits,
                        hrs: s.hrs,
                      }
                    })
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">マルチシーズン比較</h2>
                      <div className="mb-4">
                        <p className="text-xs text-sub2 mb-2">打率推移</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={seasonData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                            <YAxis domain={[0, 0.5]} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} tickFormatter={(v: number) => v.toFixed(2)} />
                            <Tooltip formatter={(v: number) => [v.toFixed(3).replace(/^0/, ''), '打率']} />
                            <Bar dataKey="avg" fill="var(--theme)" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p className="text-xs text-sub2 mb-2">OPS推移</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={seasonData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                            <YAxis domain={[0, 1.5]} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} tickFormatter={(v: number) => v.toFixed(1)} />
                            <Tooltip formatter={(v: number) => [v.toFixed(3).replace(/^0/, ''), 'OPS']} />
                            <Bar dataKey="ops" fill="var(--accent)" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 divide-y divide-s2">
                        {seasonData.map(d => (
                          <div key={d.year} className="flex items-center justify-between py-2 text-sm">
                            <span className="font-medium text-main w-16">{d.year}</span>
                            <span className="text-sub1">{d.games}試合</span>
                            <span className={`font-bold ${avgColor(d.avg)}`}>{d.avg > 0 ? d.avg.toFixed(3).replace(/^0/, '') : '---'}</span>
                            <span className={`font-bold ${opsColor(d.ops)}`}>OPS {d.ops > 0 ? d.ops.toFixed(3).replace(/^0/, '') : '---'}</span>
                            <span className="text-sub2">{d.hits}安 {d.hrs}HR</span>
                          </div>
                        ))}
                      </div>
                      {/* L7-5: 前シーズン比サマリーカード */}
                      {seasonData.length >= 2 && (() => {
                        const latest = seasonData[seasonData.length - 1]
                        const prev   = seasonData[seasonData.length - 2]
                        const avgDiff = latest.avg - prev.avg
                        const opsDiff = latest.ops - prev.ops
                        const hitsDiff = latest.hits - prev.hits
                        const hrsDiff  = latest.hrs - prev.hrs
                        const fmtRateDiff = (n: number) => {
                          const abs = Math.abs(n).toFixed(3).replace(/^0/, '')
                          return (n >= 0 ? '+' : '-') + abs
                        }
                        const fmtIntDiff = (n: number) => (n >= 0 ? '+' : '') + n
                        const diffCls = (n: number, threshold = 0.010) =>
                          n >= threshold ? 'text-pos-t' : n <= -threshold ? 'text-neg-t' : 'text-sub1'
                        return (
                          <div className="mt-3 pt-3 border-t border-s2 bg-lv2 rounded-lg p-3">
                            <p className="text-xs text-sub2 mb-2">
                              📊 前シーズン比 {prev.year} → {latest.year}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <span className={diffCls(avgDiff)}>
                                打率 {fmtRateDiff(avgDiff)}
                              </span>
                              <span className={diffCls(opsDiff)}>
                                OPS {fmtRateDiff(opsDiff)}
                              </span>
                              <span className={hitsDiff >= 0 ? 'text-pos-t' : 'text-neg-t'}>
                                安打 {fmtIntDiff(hitsDiff)}本
                              </span>
                              <span className={hrsDiff >= 0 ? 'text-pos-t' : 'text-neg-t'}>
                                HR {fmtIntDiff(hrsDiff)}本
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}

              </div>
            )
          })()}

        </div>
      )}

      {/* L-2: コピートースト */}
      {copiedFlash && (
        <div className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 bg-pos text-pos-t text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-fade-in-out z-50 whitespace-nowrap">
          ✓ コピーしました
        </div>
      )}
      {/* L6-2: CSV ダウンロードトースト */}
      {csvFlash && (
        <div className="fixed bottom-16 lg:bottom-6 left-1/2 -translate-x-1/2 bg-lv1 border border-s2 text-main text-sm font-semibold px-4 py-2 rounded-full shadow-lg animate-fade-in-out z-50 whitespace-nowrap">
          ⬇ CSV downloaded
        </div>
      )}
    </div>
  )
}
