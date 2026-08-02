import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import {
  calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP,
} from '@/lib/stats'
import type { AtBat, BattingStats, Game, PitchingStat, PitchingStats } from '@/lib/supabase/types'

export const metadata: Metadata = {
  title: '年度別成績',
  description: '年度ごとの打撃成績・投手成績と通算成績を一覧で確認',
}

interface GameWithAtBats extends Game { at_bats: AtBat[] }

// ─── 列定義 ───────────────────────────────────────────────────────────────────

type BatCol = { label: string; get: (s: BattingStats, games: number) => string | number; emphasis?: boolean }

const BAT_COLS: BatCol[] = [
  { label: '試合',   get: (_, g) => g },
  { label: '打席',   get: s => s.pa },
  { label: '打数',   get: s => s.ab },
  { label: '安打',   get: s => s.hits },
  { label: '二塁打', get: s => s.doubles },
  { label: '三塁打', get: s => s.triples },
  { label: '本塁打', get: s => s.hrs, emphasis: true },
  { label: '塁打',   get: s => s.tb },
  { label: '打点',   get: s => s.rbi, emphasis: true },
  { label: '得点',   get: s => s.runs },
  { label: '盗塁',   get: s => s.sb },
  { label: '四球',   get: s => s.walks },
  { label: '死球',   get: s => s.hbp },
  { label: '三振',   get: s => s.strikeouts },
  { label: '犠打',   get: s => s.sac_bunt },
  { label: '犠飛',   get: s => s.sac_fly },
  { label: '打率',   get: s => fmtAvg(s.avg), emphasis: true },
  { label: '出塁率', get: s => fmtAvg(s.obp) },
  { label: '長打率', get: s => fmtAvg(s.slg) },
  { label: 'OPS',    get: s => fmtDec(s.ops, 3).replace(/^0/, ''), emphasis: true },
]

type PitCol = { label: string; get: (s: PitchingStats) => string | number; emphasis?: boolean }

const PIT_COLS: PitCol[] = [
  { label: '登板',     get: s => s.games },
  { label: '勝',       get: s => s.wins, emphasis: true },
  { label: '敗',       get: s => s.losses },
  { label: 'S',        get: s => s.saves },
  { label: 'H',        get: s => s.holds },
  { label: '完投',     get: s => s.complete_games },
  { label: '投球回',   get: s => formatIP(s.innings_pitched) },
  { label: '被安打',   get: s => s.hits_allowed },
  { label: '被本塁打', get: s => s.home_runs_allowed },
  { label: '奪三振',   get: s => s.strikeouts, emphasis: true },
  { label: '与四球',   get: s => s.walks },
  { label: '与死球',   get: s => s.hit_batsmen },
  { label: '失点',     get: s => s.runs_allowed },
  { label: '自責点',   get: s => s.earned_runs },
  { label: '防御率',   get: s => fmtERA(s.era), emphasis: true },
  { label: 'WHIP',     get: s => fmtDec(s.whip, 2) },
]

// ─── ページ ───────────────────────────────────────────────────────────────────

export default async function YearlyStatsPage() {
  const [supabase, user] = await Promise.all([createClient(), getCachedUser()])

  const [{ data: gamesData }, { data: pitchingData }] = await Promise.all([
    supabase.from('games').select('*, at_bats(*)').eq('user_id', user!.id).order('game_date', { ascending: true }),
    supabase.from('pitching_stats').select('*, games!inner(season, user_id)').eq('games.user_id', user!.id),
  ])

  const games = (gamesData ?? []) as GameWithAtBats[]
  const pitching = (pitchingData ?? []) as (PitchingStat & { games: { season: number } })[]

  // 年度ごとに集計
  const seasons = Array.from(new Set(games.map(g => g.season))).sort((a, b) => b - a)

  const batRows = seasons.map(season => {
    const gs = games.filter(g => g.season === season)
    return {
      season,
      gameCount: gs.filter(g => g.at_bats.length > 0).length,
      stats: calcBattingStats(gs.flatMap(g => g.at_bats)),
      teamRecord: {
        w: gs.filter(g => g.result === 'win').length,
        l: gs.filter(g => g.result === 'loss').length,
        d: gs.filter(g => g.result === 'draw').length,
      },
    }
  }).filter(r => r.stats.pa > 0)

  const pitRows = seasons.map(season => ({
    season,
    stats: calcPitchingStats(pitching.filter(p => p.games?.season === season)),
  })).filter(r => r.stats.games > 0)

  const careerBat = calcBattingStats(games.flatMap(g => g.at_bats))
  const careerBatGames = games.filter(g => g.at_bats.length > 0).length
  const careerPit = calcPitchingStats(pitching)

  const hasBatting = batRows.length > 0
  const hasPitching = pitRows.length > 0

  const th = 'px-2.5 py-2 text-xs font-medium text-sub2 whitespace-nowrap border-b border-s2 text-right'
  const td = 'px-2.5 py-2.5 text-sm text-main whitespace-nowrap border-b border-s2 text-right tabular-nums'
  const stickyTh = 'sticky left-0 z-20 bg-lv2 px-3 py-2 text-xs font-medium text-sub2 whitespace-nowrap border-b border-r border-s2 text-left'
  const stickyTd = 'sticky left-0 z-10 px-3 py-2.5 text-sm font-semibold whitespace-nowrap border-b border-r border-s2 text-left'

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/stats" className="text-sub2 hover:text-main transition-colors text-sm">
          ← 成績
        </Link>
        <h1 className="text-2xl font-bold text-accent">年度別成績</h1>
      </div>

      {!hasBatting && !hasPitching && (
        <div className="bg-lv1 rounded-xl border border-s2 p-12 text-center">
          <div className="text-5xl mb-3">⚾</div>
          <p className="text-main font-semibold">まだ成績がありません</p>
          <p className="text-sub2 text-sm mt-1">試合と打席を記録すると、年度ごとの成績がここに並びます</p>
          <Link href="/games/new" className="inline-block mt-4 px-5 py-2.5 rounded-lg bg-theme text-white text-sm font-semibold">
            試合を登録する →
          </Link>
        </div>
      )}

      {/* 打撃成績 */}
      {hasBatting && (
        <section className="bg-lv1 rounded-xl border border-s2 overflow-hidden">
          <div className="px-5 py-3 border-b border-s2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">打撃成績</h2>
            <span className="text-[10px] text-sub2">横にスクロールできます</span>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse w-full">
              <thead>
                <tr className="bg-lv2">
                  <th className={stickyTh}>年度</th>
                  {BAT_COLS.map(c => (
                    <th key={c.label} className={th}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batRows.map(row => (
                  <tr key={row.season} className="hover:bg-lv2/60 transition-colors">
                    <td className={`${stickyTd} bg-lv1 text-accent`}>
                      <Link href={`/stats?season=${row.season}`} className="hover:underline">
                        {row.season}
                      </Link>
                    </td>
                    {BAT_COLS.map(c => (
                      <td key={c.label} className={`${td} ${c.emphasis ? 'font-semibold text-accent' : ''}`}>
                        {c.get(row.stats, row.gameCount)}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* 通算行 */}
                <tr className="bg-theme/10 border-t-2 border-theme/40">
                  <td className={`${stickyTd} bg-theme/10 text-theme`}>通算</td>
                  {BAT_COLS.map(c => (
                    <td key={c.label} className={`${td} font-bold text-theme`}>
                      {c.get(careerBat, careerBatGames)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 投手成績 */}
      {hasPitching && (
        <section className="bg-lv1 rounded-xl border border-s2 overflow-hidden">
          <div className="px-5 py-3 border-b border-s2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">投手成績</h2>
            <span className="text-[10px] text-sub2">横にスクロールできます</span>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse w-full">
              <thead>
                <tr className="bg-lv2">
                  <th className={stickyTh}>年度</th>
                  {PIT_COLS.map(c => (
                    <th key={c.label} className={th}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pitRows.map(row => (
                  <tr key={row.season} className="hover:bg-lv2/60 transition-colors">
                    <td className={`${stickyTd} bg-lv1 text-accent`}>{row.season}</td>
                    {PIT_COLS.map(c => (
                      <td key={c.label} className={`${td} ${c.emphasis ? 'font-semibold text-accent' : ''}`}>
                        {c.get(row.stats)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-theme/10 border-t-2 border-theme/40">
                  <td className={`${stickyTd} bg-theme/10 text-theme`}>通算</td>
                  {PIT_COLS.map(c => (
                    <td key={c.label} className={`${td} font-bold text-theme`}>
                      {c.get(careerPit)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* チーム戦績（年度別） */}
      {hasBatting && (
        <section className="bg-lv1 rounded-xl border border-s2 overflow-hidden">
          <div className="px-5 py-3 border-b border-s2">
            <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">年度別チーム戦績</h2>
          </div>
          <div className="divide-y divide-s2">
            {batRows.map(row => {
              const { w, l, d } = row.teamRecord
              const total = w + l
              const rate = total > 0 ? (w / total).toFixed(3).replace(/^0/, '') : '---'
              const winPct = total > 0 ? (w / total) * 100 : 0
              return (
                <div key={row.season} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-sm font-semibold text-accent w-14 shrink-0">{row.season}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-2 rounded-full bg-lv2 overflow-hidden flex">
                      <div className="h-full bg-pos-t/70" style={{ width: `${winPct}%` }} />
                      <div className="h-full bg-neg-t/50" style={{ width: `${100 - winPct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-sub1 shrink-0 tabular-nums">
                    {w}勝{l}敗{d > 0 ? `${d}分` : ''}
                    <span className="text-sub2 ml-1.5">勝率{rate}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {(hasBatting || hasPitching) && (
        <p className="text-xs text-sub2">
          年度をクリックすると、そのシーズンの詳細な成績画面へ移動します。
        </p>
      )}
    </div>
  )
}
