'use client'

import { useEffect, useState, useRef, useContext, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP } from '@/lib/stats'
import { RESULT_TYPE_LABELS, DIRECTION_LABELS, FIELDING_POSITIONS } from '@/lib/supabase/types'
import type { AtBat, BattingStats, Direction, Game, ResultType, PitchingStat } from '@/lib/supabase/types'
import DirectionChart from '@/app/(protected)/_components/DirectionChart'
import SprayChart from '@/app/(protected)/_components/SprayChart'
import { ThemeContext } from '@/app/(protected)/_components/ThemeProvider'
import StatTooltip from '@/app/(protected)/_components/StatTooltip'

// PERF-9: recharts を使うのは「分析」タブだけなので遅延ロードする。
// 既定表示のシーズン累計タブでは約104kB(gzip)のダウンロードが不要になる。
const AnalyticsTab = dynamic(() => import('./_AnalyticsTab'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 min-h-[520px]">
      {[1, 2].map(i => (
        <div key={i} className="bg-lv1 rounded-xl border border-s2 p-5 animate-pulse">
          <div className="h-4 w-32 bg-lv2 rounded mb-4" />
          <div className="h-48 bg-lv2 rounded" />
        </div>
      ))}
    </div>
  ),
})

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

// ────────────────────────────────────────────────
// S-2: KPIカード用スパークライン（軸ラベルなしの極小推移線）
//   単独で値を読ませるものではなく、「上り調子か下り調子か」の文脈だけを与える。
// ────────────────────────────────────────────────
function Sparkline({ values, colorVar = 'var(--theme)' }: { values: number[]; colorVar?: string }) {
  if (values.length < 2) return <div className="h-[14px]" />
  const w = 44
  const h = 14
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = values[values.length - 1]
  const lastX = w
  const lastY = h - ((last - min) / range) * (h - 2) - 1
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={colorVar} strokeWidth="1.4" strokeOpacity="0.75"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY.toFixed(1)} r="1.8" fill={colorVar} />
    </svg>
  )
}

// S-2: 通算との差分表示（▲▼で形状も併用し、色のみに依存しない）
function DiffBadge({ diff, digits = 3 }: { diff: number | null; digits?: number }) {
  if (diff === null || !isFinite(diff)) return <div className="h-[13px]" />
  const threshold = 0.005
  const cls = diff >= threshold ? 'text-pos-t' : diff <= -threshold ? 'text-neg-t' : 'text-sub2'
  const mark = diff >= threshold ? '▲' : diff <= -threshold ? '▼' : '→'
  const abs = Math.abs(diff).toFixed(digits).replace(/^0/, '')
  return (
    <div className={`text-[10px] font-semibold leading-none ${cls}`}>
      {mark}{abs}
    </div>
  )
}

type PeriodPreset = 'all' | 'last5' | 'last10' | 'month' | 'custom'

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: '全期間',
  last5: '直近5試合',
  last10: '直近10試合',
  month: '今月',
  custom: '期間指定',
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
  const [allGames, setAllGames] = useState<GameWithAtBats[]>([])
  const [allPitchingStats, setAllPitchingStats] = useState<PitchingStat[]>([])
  const [loading, setLoading] = useState(true)
  // S-3: 任意軸フィルタ（全タブ横断）
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [opponentFilter, setOpponentFilter] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  // S-2: 通算成績（KPIカードの比較基準）
  const [careerStats, setCareerStats] = useState<BattingStats | null>(null)
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
  // P-10: タブ自動スクロール用 ref
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})

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
        setAllGames(cached.games)
        setAllPitchingStats(cached.pitchingStats)
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
      setAllGames(gamesData)
      setAllPitchingStats(psData)
      cacheRef.current.set(season, { games: gamesData, pitchingStats: psData })
      setLoading(false)
    }
    fetchData()
  }, [supabase, season])

  // S-2: 通算打撃成績を1回だけ取得（KPIカードの比較基準として使う）
  useEffect(() => {
    const fetchCareer = async () => {
      const { data } = await supabase.from('at_bats').select('*')
      if (data) setCareerStats(calcBattingStats(data as AtBat[]))
    }
    fetchCareer()
  }, [supabase])

  // S-3: sessionStorage からフィルタ状態を復元
  useEffect(() => {
    const saved = sessionStorage.getItem('baseball_stats_filter')
    if (!saved) return
    try {
      const f = JSON.parse(saved)
      if (f.periodPreset) setPeriodPreset(f.periodPreset)
      if (f.customFrom) setCustomFrom(f.customFrom)
      if (f.customTo) setCustomTo(f.customTo)
      if (f.opponentFilter) setOpponentFilter(f.opponentFilter)
    } catch { /* 破損時は無視 */ }
  }, [])

  // S-3: フィルタ状態を保存
  useEffect(() => {
    sessionStorage.setItem('baseball_stats_filter', JSON.stringify({
      periodPreset, customFrom, customTo, opponentFilter,
    }))
  }, [periodPreset, customFrom, customTo, opponentFilter])

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
    // S-3: シーズンを変えたら絞り込みは解除（前シーズンの対戦相手が残ると0件になるため）
    setPeriodPreset('all')
    setCustomFrom('')
    setCustomTo('')
    setOpponentFilter('')
  }

  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return
    // M7-3: 現在のスクロール位置を保存してからタブ切り替え
    scrollPositions.current[tab] = window.scrollY
    sessionStorage.setItem('baseball_stats_tab', newTab)
    setTabVisible(false)
    setTab(newTab)
    // PERF-5: 二重 requestAnimationFrame は約2フレーム（≒32ms）の空白を生んでいた。
    // 新タブのDOMは setTab の再レンダリングで既に構築済みなので、1フレームで十分。
    requestAnimationFrame(() => {
      // M7-3: 新タブの前回スクロール位置を復元（初回は0）
      window.scrollTo({ top: scrollPositions.current[newTab] ?? 0, behavior: 'instant' })
      setTabVisible(true)
    })
  }

  // P-10: タブ切り替え時にアクティブタブを中央にスクロール
  useEffect(() => {
    const btn = tabButtonRefs.current[tab]
    const container = tabScrollRef.current
    if (!btn || !container) return
    const containerRect = container.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    const scrollLeft = container.scrollLeft + (btnRect.left - containerRect.left)
      - containerRect.width / 2 + btnRect.width / 2
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [tab])

  // ────────────────────────────────────────────────
  // S-3: 任意軸フィルタの適用
  //   allGames（取得結果）→ games（表示対象）に絞り込む。
  //   以降の全タブは games / pitchingStats のみを参照するため、
  //   1箇所の絞り込みが全タブに横断で効く。
  // ────────────────────────────────────────────────
  const opponentOptions = useMemo(
    () => [...new Set(allGames.map(g => g.opponent).filter(Boolean))].sort(),
    [allGames]
  )

  const games = useMemo(() => {
    // allGames は game_date の降順
    let gs = allGames
    if (opponentFilter) gs = gs.filter(g => g.opponent === opponentFilter)
    if (periodPreset === 'month') {
      const now = new Date()
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      gs = gs.filter(g => g.game_date.startsWith(ym))
    } else if (periodPreset === 'custom') {
      if (customFrom) gs = gs.filter(g => g.game_date >= customFrom)
      if (customTo)   gs = gs.filter(g => g.game_date <= customTo)
    } else if (periodPreset === 'last5' || periodPreset === 'last10') {
      gs = gs.slice(0, periodPreset === 'last5' ? 5 : 10)
    }
    return gs
  }, [allGames, opponentFilter, periodPreset, customFrom, customTo])

  const pitchingStats = useMemo(() => {
    if (games.length === allGames.length) return allPitchingStats
    const ids = new Set(games.map(g => g.id))
    return allPitchingStats.filter(ps => ids.has(ps.game_id))
  }, [allPitchingStats, games, allGames])

  const filterActive = periodPreset !== 'all' || opponentFilter !== ''
  const activeFilterCount = (periodPreset !== 'all' ? 1 : 0) + (opponentFilter ? 1 : 0)
  const resetFilters = () => {
    setPeriodPreset('all')
    setCustomFrom('')
    setCustomTo('')
    setOpponentFilter('')
  }

  // PERF-6: calcBattingStats は配列を13回走査するため、タブ切替のたびの再計算は無視できない
  const allAtBats = useMemo(() => games.flatMap((g) => g.at_bats), [games])
  const stats = useMemo(() => calcBattingStats(allAtBats), [allAtBats])
  const pStats = useMemo(() => calcPitchingStats(pitchingStats), [pitchingStats])

  // ────────────────────────────────────────────────
  // S-2: KPIカードの比較値とスパークライン
  //   比較基準は通算成績。「打率.285」だけでは良否が判断できないため、
  //   参照値を必ず添えるというダッシュボード設計の原則に従う。
  // ────────────────────────────────────────────────
  const sparkSeries = useMemo(() => {
    // 古い順に累積成績を積み上げ、直近12点を返す
    const chrono = [...games].sort((a, b) => a.game_date.localeCompare(b.game_date))
    const avg: number[] = [], obp: number[] = [], slg: number[] = [], ops: number[] = []
    let acc: AtBat[] = []
    for (const g of chrono) {
      if (g.at_bats.length === 0) continue
      acc = acc.concat(g.at_bats)
      const s = calcBattingStats(acc)
      if (s.avg !== null) avg.push(s.avg)
      if (s.obp !== null) obp.push(s.obp)
      if (s.slg !== null) slg.push(s.slg)
      if (s.ops !== null) ops.push(s.ops)
    }
    const tail = (arr: number[]) => arr.slice(-12)
    return { avg: tail(avg), obp: tail(obp), slg: tail(slg), ops: tail(ops) }
  }, [games])

  // 通算のサンプルが極端に少ない場合は比較を出さない（誤解を招くため）
  const careerBaselineReady = careerStats !== null && careerStats.pa >= 20
  const diffOf = (cur: number | null, base: number | null): number | null =>
    careerBaselineReady && cur !== null && base !== null ? cur - base : null

  const wins = games.filter((g) => g.result === 'win').length
  const losses = games.filter((g) => g.result === 'loss').length
  const draws = games.filter((g) => g.result === 'draw').length
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, '') : '---'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-accent">成績</h1>
          <Link
            href="/stats/yearly"
            className="text-xs border border-s2 rounded-lg px-3 py-1.5 text-sub1 hover:bg-lv2 hover:text-main transition-colors whitespace-nowrap"
          >
            📅 年度別成績 →
          </Link>
        </div>
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

      {/* S-3: 任意軸フィルタバー（全タブ横断） */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              filterActive
                ? 'bg-theme/10 border-theme/50 text-theme'
                : 'bg-lv1 border-s2 text-sub1 hover:text-main'
            }`}
            aria-expanded={filterOpen}
          >
            <span>絞り込み</span>
            {activeFilterCount > 0 && (
              <span className="bg-theme text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
            <span className="text-xs text-sub2">{filterOpen ? '▲' : '▼'}</span>
          </button>

          {filterActive && (
            <>
              <span className="text-xs text-sub1">
                <span className="font-semibold text-main">{games.length}</span>
                <span className="text-sub2"> / {allGames.length} 試合</span>
              </span>
              <span className="text-xs text-theme">
                {periodPreset !== 'all' && (
                  <span className="mr-1.5">
                    {periodPreset === 'custom'
                      ? `${customFrom || '最初'}〜${customTo || '最新'}`
                      : PERIOD_LABELS[periodPreset]}
                  </span>
                )}
                {opponentFilter && <span>vs {opponentFilter}</span>}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-sub2 hover:text-neg-t underline underline-offset-2"
              >
                解除
              </button>
            </>
          )}
        </div>

        {filterOpen && (
          <div className="bg-lv1 border border-s2 rounded-xl p-4 space-y-3">
            {/* 期間 */}
            <div>
              <p className="text-xs font-medium text-sub1 mb-1.5">期間</p>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'last5', 'last10', 'month', 'custom'] as PeriodPreset[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriodPreset(p)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      periodPreset === p
                        ? 'bg-theme border-theme text-white font-medium'
                        : 'bg-lv2 border-s2 text-sub1 hover:text-main'
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
              {periodPreset === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="flex-1 min-w-0 border border-s2 rounded-lg px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme"
                    aria-label="開始日"
                  />
                  <span className="text-sub2 text-sm shrink-0">〜</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="flex-1 min-w-0 border border-s2 rounded-lg px-2 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme"
                    aria-label="終了日"
                  />
                </div>
              )}
            </div>

            {/* 対戦相手 */}
            {opponentOptions.length > 1 && (
              <div>
                <p className="text-xs font-medium text-sub1 mb-1.5">対戦相手</p>
                <select
                  value={opponentFilter}
                  onChange={e => setOpponentFilter(e.target.value)}
                  className="w-full border border-s2 rounded-lg px-3 py-2 text-sm bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme"
                >
                  <option value="">すべての対戦相手</option>
                  {opponentOptions.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )}

            {filterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="w-full py-2 rounded-lg border border-s2 text-sm text-sub1 hover:bg-lv2 transition-colors"
              >
                絞り込みを解除
              </button>
            )}
          </div>
        )}
      </div>

      {/* R-6: 二重タブ実装（PC=hidden lg:block / スマホ=fixed bottom-0）を撤廃し、
            sticky top-0 z-30 の 1 つのタブに統合。R-1 グローバルナビ(z-40) と非干渉、
            ページ内タブはサブナビとして上部 sticky にする方針（標準パターン）。 */}
      {/* P-10: タブナビゲーション（自動スクロール＋グラデーションマスク） */}
      <div className="sticky top-0 z-30 bg-lv2 border-b border-s2 -mx-4 px-4">
        <div className="relative max-w-5xl mx-auto">
          {/* 左フェード（先に戻れることを示す） */}
          <div
            className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to right, var(--bg_lv2) 0%, transparent 100%)' }}
          />
          {/* 右フェード（続きがあることを示す） */}
          <div
            className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10"
            style={{ background: 'linear-gradient(to left, var(--bg_lv2) 0%, transparent 100%)' }}
          />
          {/* P-10: tabScrollRef をタブコンテナに付与 */}
          <div ref={tabScrollRef} className="flex overflow-x-auto scrollbar-none">
            {TAB_LIST.map(({ key, label }) => (
              <button
                key={key}
                ref={el => { tabButtonRefs.current[key] = el }}
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
            transition: tabVisible ? 'opacity 0.08s ease-out' : 'none',
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
                    {/* 主要指標ハイライト（S-2: 通算比とスパークラインを併記） */}
                    <div className="grid grid-cols-4 divide-x divide-s2 border-b border-s2">
                      {[
                        { label: '打率',   value: fmtAvg(stats.avg), colorClass: avgColor(stats.avg),
                          diff: diffOf(stats.avg, careerStats?.avg ?? null), spark: sparkSeries.avg },
                        { label: '出塁率', value: fmtAvg(stats.obp), colorClass: 'text-accent',
                          diff: diffOf(stats.obp, careerStats?.obp ?? null), spark: sparkSeries.obp },
                        { label: '長打率', value: fmtAvg(stats.slg), colorClass: 'text-accent',
                          diff: diffOf(stats.slg, careerStats?.slg ?? null), spark: sparkSeries.slg },
                        { label: 'OPS',    value: fmtDec(stats.ops, 3).replace(/^0/, ''), colorClass: opsColor(stats.ops),
                          diff: diffOf(stats.ops, careerStats?.ops ?? null), spark: sparkSeries.ops },
                      ].map(({ label, value, colorClass, diff, spark }) => (
                        <div key={label} className="flex flex-col items-center py-3.5 px-1.5 gap-1">
                          <span className="text-xs text-sub2">
                            <StatTooltip label={label} />
                          </span>
                          <span className={`text-2xl font-bold leading-none ${colorClass}`}>{value}</span>
                          <DiffBadge diff={diff} />
                          <Sparkline values={spark} />
                        </div>
                      ))}
                    </div>
                    {careerBaselineReady && (
                      <div className="px-5 py-1.5 border-b border-s2 bg-lv2/50">
                        <p className="text-[10px] text-sub2">
                          ▲▼は通算成績（{careerStats!.pa}打席・打率{fmtAvg(careerStats!.avg)}）との差。折れ線は直近の推移。
                        </p>
                      </div>
                    )}
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
          {tab === 'analytics' && (
            <AnalyticsTab
              games={games}
              stats={stats}
              pitchingStats={pitchingStats}
              allAtBats={allAtBats}
              season={season}
            />
          )}

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
