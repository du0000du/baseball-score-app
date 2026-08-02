import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getCachedUser } from '@/lib/supabase/server'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP } from '@/lib/stats'
import type { AtBat, Game, User, PitchingStat, BattingStats } from '@/lib/supabase/types'
import DashboardSeasonSelector from '@/app/(protected)/_components/DashboardSeasonSelector'
import DashboardTargetMeter from '@/app/(protected)/_components/DashboardTargetMeter'
import DashboardMilestoneToast from '@/app/(protected)/_components/DashboardMilestoneToast'
import {
  aggregateBySeason,
  calcRecentPace,
  computeCareerBests,
  computeNextMilestones,
  computeRecommendations,
  computeSeasonBests,
} from '@/lib/records'

export const metadata: Metadata = {
  title: 'ダッシュボード',
  description: 'シーズン打撃成績・チーム戦績・最近の活躍を確認',
}

// 実績バッジ（達成済みの表示のみ。未達成分は「次のマイルストーン」が担当する）
const BADGES: { id: string; label: string; emoji: string; cond: (s: BattingStats) => boolean }[] = [
  { id: 'three_hundred', label: '.300打者',  emoji: '🏆', cond: (s) => (s.avg ?? 0) >= 0.300 },
  { id: 'five_hr',       label: '5本塁打',   emoji: '💪', cond: (s) => s.hrs >= 5 },
  { id: 'ten_hr',        label: '10本塁打',  emoji: '🔥', cond: (s) => s.hrs >= 10 },
  { id: 'ten_rbi',       label: '10打点',    emoji: '⚡', cond: (s) => s.rbi >= 10 },
  { id: 'ten_sb',        label: '10盗塁',    emoji: '💨', cond: (s) => s.sb >= 10 },
  { id: 'ops_eight',     label: 'OPS .800+', emoji: '📈', cond: (s) => (s.ops ?? 0) >= 0.800 },
  { id: 'ops_nine',      label: 'OPS .900+', emoji: '🌟', cond: (s) => (s.ops ?? 0) >= 0.900 },
  { id: 'twenty_hits',   label: '20安打',    emoji: '🎯', cond: (s) => s.hits >= 20 },
  { id: 'no_strikeout',  label: '無三振10打席', emoji: '🛡️', cond: (s) => s.strikeouts === 0 && s.pa >= 10 },
]

// 指標の種類に応じた表示フォーマット
function fmtByKind(kind: 'count' | 'rate', v: number | null): string {
  if (v === null) return '---'
  return kind === 'rate' ? fmtAvg(v) : String(v)
}

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

function ScoreDisplay({ game }: { game: Game }) {
  const score = (
    <span className="text-main dark:text-white">
      {game.score_us}<span className="text-sub2 font-normal mx-0.5">-</span>{game.score_them}
    </span>
  )
  if (game.result === 'win') return (
    <span className="flex items-center gap-1 text-base font-bold leading-none">
      <span className="text-pos-t">○</span>{score}
    </span>
  )
  if (game.result === 'loss') return (
    <span className="flex items-center gap-1 text-base font-bold leading-none">
      <span className="text-sub2">●</span>{score}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-base font-bold leading-none">
      <span className="text-neu-t">△</span>{score}
    </span>
  )
}

interface GameWithAtBats extends Game { at_bats: AtBat[] }

export default async function DashboardPage({ searchParams }: { searchParams: { year?: string } }) {
  // PERF-8: layout と同一リクエスト内なのでキャッシュ済みの user を再利用（往復ゼロ）
  const [supabase, user] = await Promise.all([createClient(), getCachedUser()])
  const currentYear = new Date().getFullYear()
  // M7-1: URL searchParam でシーズン切り替え（デフォルト: 当年）
  const displayYear = searchParams.year ? parseInt(searchParams.year) : currentYear

  // PERF-1: 依存関係のない3クエリを並列化（従来は逐次awaitで4往復）
  // PERF-2: 全シーズンの games を1回だけ取得し、当年分はメモリ上で導出する
  //         （従来は「当年のgames」と「全期間のgames」を二重取得していた）
  const [{ data: profile }, { data: careerGamesData }, { data: pitchingData }] = await Promise.all([
    supabase.from('users').select('team_name, name').eq('id', user!.id).single(),
    supabase.from('games').select('*, at_bats(*)').eq('user_id', user!.id).order('game_date', { ascending: true }),
    supabase.from('pitching_stats').select('*, games!inner(season, user_id)').eq('games.season', displayYear).eq('games.user_id', user!.id),
  ])
  const typedProfile = profile as Pick<User, 'team_name' | 'name'> | null

  // careerGames は昇順（古い順）。連続記録の走査はこの順序を前提にする。
  const careerGames = (careerGamesData ?? []) as GameWithAtBats[]
  // 表示中シーズンの試合は降順（新しい順）— 従来のクエリ順序を再現
  const typedGames = careerGames
    .filter(g => g.season === displayYear)
    .slice()
    .sort((a, b) => b.game_date.localeCompare(a.game_date))

  const allAtBats = typedGames.flatMap((g) => g.at_bats)
  const stats = calcBattingStats(allAtBats)
  const recentGames = typedGames.slice(0, 5)

  const wins = typedGames.filter((g) => g.result === 'win').length
  const losses = typedGames.filter((g) => g.result === 'loss').length
  const draws = typedGames.filter((g) => g.result === 'draw').length
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, '') : '---'

  const pitchingStats = (pitchingData ?? []) as PitchingStat[]
  const pStats = calcPitchingStats(pitchingStats)

  // M8-6: 直近2登板（typedGames は game_date desc 順なので先頭から検索）
  const recentPitching = typedGames
    .filter(g => pitchingStats.some(ps => ps.game_id === g.id))
    .slice(0, 2)
    .map(g => ({
      game: g,
      ps: pitchingStats.find(ps => ps.game_id === g.id)!,
    }))

  // N-2: 連続安打ストリーク算出
  const sortedByDate = [...typedGames].sort((a, b) => b.game_date.localeCompare(a.game_date))
  let hitStreak = 0
  for (const game of sortedByDate) {
    if (game.at_bats.length === 0) continue  // 打席ゼロの試合はスキップ（連続を途切れさせない）
    const hasHit = game.at_bats.some(ab => ['hit', 'double', 'triple', 'hr'].includes(ab.result_type))
    if (hasHit) hitStreak++
    else break
  }

  // P-3: 打席未入力試合カウント（メモあり試合は除外）
  const unrecordedCount = typedGames.filter(
    g => g.at_bats.length === 0 && !(g.notes && g.notes.trim() !== '')
  ).length

  const recentAtBats = recentGames.flatMap((g) => g.at_bats)
  const recentStats = calcBattingStats(recentAtBats)
  const recentN = Math.min(5, typedGames.length)
  const avgDiff = recentAtBats.length > 0 && stats.avg !== null ? (recentStats.avg ?? 0) - (stats.avg ?? 0) : null
  const diffClass = avgDiff === null ? '' : avgDiff >= 0.010 ? 'text-pos-t' : avgDiff <= -0.010 ? 'text-neg-t' : 'text-sub2'
  const diffLabel = avgDiff === null ? '' : avgDiff >= 0.010 ? `▲+${fmtAvg(avgDiff)}` : avgDiff <= -0.010 ? `▼${fmtAvg(avgDiff)}` : `→ ${fmtAvg(avgDiff)}`

  const card = "bg-lv1 rounded-xl shadow-sm border border-s2"
  const sectionTitle = "text-sm font-semibold text-sub1 uppercase tracking-wide"
  const bigStat = "text-xl font-bold text-accent truncate tabular-nums"
  const subLabel = "text-xs text-sub2 mt-1"
  const smallVal = "text-xs font-semibold text-main"
  const smallLabel = "text-[10px] text-sub2"
  const divider = "border-t border-s2"

  const earnedIds = BADGES.filter(b => b.cond(stats)).map(b => b.id)
  const BADGE_LABELS: Record<string, string> = Object.fromEntries(
    BADGES.map(b => [b.id, `${b.emoji} ${b.label}`])
  )

  // ────────────────────────────────────────────────
  // T-1〜T-3: 記録分析（今季マイルストーン / シーズンベスト比較 / 通算ベスト / おすすめ）
  //   算出ロジックは lib/records.ts に集約している
  // ────────────────────────────────────────────────
  const seasonAggs   = aggregateBySeason(careerGames)
  const careerBests  = computeCareerBests(careerGames, seasonAggs)
  const careerStats  = careerBests.careerStats
  const seasonBests  = computeSeasonBests(seasonAggs, displayYear)
  // ペースは表示中シーズンの直近5試合から（typedGames は新しい順）
  const recentPace   = calcRecentPace(typedGames, 5)
  const nextMilestones = computeNextMilestones(stats, recentPace, 4)
  const recommendations = computeRecommendations(
    stats, seasonAggs, displayYear, careerBests, recentPace, 3,
  )

  const hasPersonalBests = careerStats.pa > 0
  const hasPastSeason = seasonAggs.some(s => s.season !== displayYear)

  return (
    <div className="space-y-6">
      {/* L7-4: マイルストーン初回達成トースト */}
      <DashboardMilestoneToast earnedIds={earnedIds} badgeLabels={BADGE_LABELS} />
      {/* P-3: 打席未入力警告バナー */}
      {unrecordedCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-neu/30 border border-neu/50 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-neu-t text-lg">⚠️</span>
            <span className="text-sm text-neu-t font-medium">
              打席未入力の試合が {unrecordedCount} 件あります
            </span>
          </div>
          <Link href="/games" className="text-xs text-theme font-medium underline underline-offset-2 whitespace-nowrap shrink-0">
            試合一覧へ →
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-accent">{displayYear}年</h1>
            {/* M7-1: シーズンセレクター */}
            <DashboardSeasonSelector currentYear={currentYear} selectedYear={displayYear} />
          </div>
          {typedProfile?.team_name && <p className="text-sm text-sub1 mt-0.5">{typedProfile.team_name}</p>}
        </div>
        <Link href="/games/new" className="shrink-0 btn bg-theme hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium">
          ＋ 試合を登録
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-6 lg:space-y-0">
        {/* 左カラム */}
        <div className="lg:col-span-2 space-y-6">
          {/* チーム戦績 */}
          {typedGames.length > 0 && (
            <div className={`${card} p-5`}>
              <h2 className={`${sectionTitle} mb-3`}>チーム戦績</h2>
              {/* FX-1: フォント幅増大テーマ対応 — text-lg + gap-1.5 で横幅オーバー防止 */}
              <div className="grid grid-cols-5 gap-1.5 text-center">
                <div><div className="text-lg font-bold text-accent truncate">{typedGames.length}</div><div className={subLabel}>試合</div></div>
                <div><div className="text-lg font-bold text-accent">{wins}</div><div className={subLabel}>勝</div></div>
                <div><div className="text-lg font-bold text-accent">{losses}</div><div className={subLabel}>負</div></div>
                <div><div className="text-lg font-bold text-accent">{draws}</div><div className={subLabel}>分</div></div>
                <div><div className="text-lg font-bold text-accent truncate">{winRate}</div><div className={subLabel}>勝率</div></div>
              </div>
            </div>
          )}

          {/* M-3: 試合ゼロ時の Empty State */}
          {typedGames.length === 0 && (
            <div className={`${card} p-5`}>
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <div className="text-5xl">⚾</div>
                <p className="text-main font-semibold text-lg">まだ試合がありません</p>
                <p className="text-sub2 text-sm">「試合を追加」から最初の試合を登録しましょう</p>
                <Link href="/games/new" className="mt-2 px-5 py-2.5 rounded-lg bg-theme text-white text-sm font-semibold">
                  試合を追加する →
                </Link>
              </div>
            </div>
          )}

          {/* N-2: 連続安打バナー */}
          {hitStreak >= 2 && (
            <div className={`${card} px-5 py-3 flex items-center gap-2`}>
              <span className="text-xl">🔥</span>
              <span className="text-sm font-semibold text-main">{hitStreak}試合連続安打中</span>
            </div>
          )}

          {/* 打撃成績 */}
          <div className={`${card} p-6`}>
            <h2 className={`${sectionTitle} mb-4`}>シーズン打撃成績</h2>
            {allAtBats.length === 0 ? (
              <p className="text-sub2 text-center py-4">まだ打席記録がありません</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center min-w-0"><div className={`text-xl font-bold tabular-nums truncate ${avgColor(stats.avg)}`}>{fmtAvg(stats.avg)}</div><div className={subLabel}>打率</div></div>
                  <div className="text-center min-w-0"><div className={bigStat}>{fmtAvg(stats.obp)}</div><div className={subLabel}>出塁率</div></div>
                  <div className="text-center min-w-0"><div className={bigStat}>{fmtAvg(stats.slg)}</div><div className={subLabel}>長打率</div></div>
                  <div className="text-center min-w-0"><div className={`text-xl font-bold tabular-nums truncate ${opsColor(stats.ops)}`}>{fmtDec(stats.ops, 3).replace(/^0/, '')}</div><div className={subLabel}>OPS</div></div>
                </div>
                {/* FX-1: 7列グリッド — gap-1 で列幅を確保、smallVal/smallLabel で文字縮小済み */}
                <div className={`grid grid-cols-7 gap-1 pt-4 ${divider} text-center`}>
                  <div><div className={smallVal}>{typedGames.length}</div><div className={smallLabel}>試合</div></div>
                  <div><div className={smallVal}>{stats.pa}</div><div className={smallLabel}>打席</div></div>
                  <div><div className={smallVal}>{stats.ab}</div><div className={smallLabel}>打数</div></div>
                  <div><div className={smallVal}>{stats.hits}</div><div className={smallLabel}>安打</div></div>
                  <div><div className={smallVal}>{stats.hrs}</div><div className={smallLabel}>本塁打</div></div>
                  <div><div className={smallVal}>{stats.rbi}</div><div className={smallLabel}>打点</div></div>
                  <div><div className={smallVal}>{stats.sb}</div><div className={smallLabel}>盗塁</div></div>
                </div>
                {/* M6-3: 安打内訳（単打/二塁打/三塁打/HR） */}
                {/* FX-1: 安打内訳 — gap-1 で列幅を確保 */}
                {stats.hits > 0 && (
                  <div className={`grid grid-cols-4 gap-1 pt-3 ${divider} text-center`}>
                    <div><div className={smallVal}>{stats.hits - stats.doubles - stats.triples - stats.hrs}</div><div className={smallLabel}>単打</div></div>
                    <div><div className={smallVal}>{stats.doubles}</div><div className={smallLabel}>二塁打</div></div>
                    <div><div className={smallVal}>{stats.triples}</div><div className={smallLabel}>三塁打</div></div>
                    <div><div className="font-semibold text-accent">{stats.hrs}</div><div className={smallLabel}>本塁打</div></div>
                  </div>
                )}
                {/* 実績バッジ (B-3) */}
                {(() => {
                  const earned = BADGES.filter(b => b.cond(stats))
                  if (earned.length === 0) return null
                  return (
                    <div className={`mt-4 pt-4 ${divider}`}>
                      <p className="text-xs text-sub2 mb-2">🏅 今シーズンの実績</p>
                      <div className="flex flex-wrap gap-2">
                        {earned.map(b => (
                          <span key={b.id} className="flex items-center gap-1 text-xs bg-lv2 border border-s2 rounded-full px-2.5 py-1 text-sub1">
                            <span>{b.emoji}</span>
                            <span>{b.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </div>

          {/* T-1: 次のマイルストーン（今季成績を分析して次に狙える節目を動的算出） */}
          {nextMilestones.length > 0 && (
            <div className={`${card} p-5`}>
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 className={sectionTitle}>次のマイルストーン</h2>
                <span className="text-[10px] text-sub2">{displayYear}年の成績から算出</span>
              </div>
              <div className="space-y-3">
                {nextMilestones.map(m => (
                  <div key={m.id}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0">{m.emoji}</span>
                        <span className="text-sm text-main font-medium truncate">{m.label}</span>
                      </div>
                      <span className="text-sm font-bold text-theme shrink-0 tabular-nums">
                        {m.remainingText}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-lv2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-theme transition-all"
                        style={{ width: `${Math.round(m.progress * 100)}%` }}
                      />
                    </div>
                    {m.hint && (
                      <p className="text-[10px] text-sub2 mt-1">{m.hint}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* T-3: 直近ペースから狙えそうな記録のおすすめ */}
          {recommendations.length > 0 && (
            <div className={`${card} p-5`}>
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 className={sectionTitle}>狙える記録</h2>
                {recentPace && (
                  <span className="text-[10px] text-sub2">直近{recentPace.games}試合のペースから</span>
                )}
              </div>
              <div className="space-y-2.5">
                {recommendations.map(r => (
                  <div key={r.id} className="flex items-start gap-2.5 rounded-lg bg-lv2 px-3 py-2.5">
                    <span className="text-lg leading-none shrink-0 mt-0.5">{r.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-main">{r.title}</p>
                      <p className="text-xs text-sub1 mt-0.5 leading-relaxed">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* L7-3: 目標打率メーター（Client Component — localStorage を読む） */}
          {allAtBats.length > 0 && (
            <DashboardTargetMeter currentAvg={stats.avg} />
          )}

          {/* T-2a: シーズンベスト vs 今季 */}
          {hasPersonalBests && (
            <div className={`${card} p-5`}>
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 className={sectionTitle}>シーズンベストとの比較</h2>
                <span className="text-[10px] text-sub2">
                  {hasPastSeason ? `${displayYear}年 vs 歴代最高` : '今季が初シーズン'}
                </span>
              </div>
              <div className="space-y-1">
                {/* ヘッダ行 */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center pb-1.5 border-b border-s2">
                  <span className="text-[10px] text-sub2">指標</span>
                  <span className="text-[10px] text-sub2 w-12 text-right">今季</span>
                  <span className="text-[10px] text-sub2 w-14 text-right">ベスト</span>
                  <span className="text-[10px] text-sub2 w-12 text-right">差</span>
                </div>
                {seasonBests.map(b => {
                  const diff = b.current !== null && b.best !== null ? b.current - b.best : null
                  const diffText = diff === null
                    ? '---'
                    : b.isCurrentBest
                      ? '最高'
                      : b.kind === 'rate'
                        ? (diff >= 0 ? '+' : '') + fmtAvg(diff)
                        : (diff >= 0 ? '+' : '') + String(diff)
                  const diffClassName = b.isCurrentBest
                    ? 'text-pos-t font-bold'
                    : diff === null ? 'text-sub2'
                    : diff >= 0 ? 'text-pos-t' : 'text-sub2'
                  return (
                    <div key={b.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center py-1.5">
                      <span className="text-xs text-sub1 truncate">{b.label}</span>
                      <span className="text-sm font-bold text-main w-12 text-right tabular-nums">
                        {fmtByKind(b.kind, b.current)}
                      </span>
                      <span className="text-xs text-sub1 w-14 text-right tabular-nums">
                        {fmtByKind(b.kind, b.best)}
                        {b.bestSeason !== null && !b.isCurrentBest && (
                          <span className="text-[9px] text-sub2 block leading-none">{b.bestSeason}年</span>
                        )}
                      </span>
                      <span className={`text-xs w-12 text-right tabular-nums ${diffClassName}`}>
                        {diffText}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-sub2 mt-2">
                打率とOPSは20打席以上のシーズンのみを比較対象にしています
              </p>
            </div>
          )}

          {/* T-2b: 通算ベスト */}
          {hasPersonalBests && (
            <div className={`${card} p-5`}>
              <h2 className={`${sectionTitle} mb-3`}>通算ベスト</h2>
              <div className={`grid grid-cols-4 gap-1.5 text-center pb-3 border-b border-s2`}>
                <div><div className={bigStat}>{careerStats.pa}</div><div className={subLabel}>通算打席</div></div>
                <div><div className={bigStat}>{careerStats.hits}</div><div className={subLabel}>通算安打</div></div>
                <div><div className={bigStat}>{careerStats.hrs}</div><div className={subLabel}>通算本塁打</div></div>
                <div><div className={`text-xl font-bold tabular-nums truncate ${avgColor(careerStats.avg)}`}>{fmtAvg(careerStats.avg)}</div><div className={subLabel}>通算打率</div></div>
              </div>
              <div className="space-y-2 pt-3">
                {careerBests.mostHitsInGame && careerBests.mostHitsInGame.value > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-sub1">1試合最多安打</span>
                    <span className="text-xs text-main">
                      <span className="font-bold text-base text-accent mr-1">{careerBests.mostHitsInGame.value}</span>
                      本
                      <span className="text-sub2 ml-1.5">
                        {formatDate(careerBests.mostHitsInGame.date)} vs {careerBests.mostHitsInGame.opponent}
                      </span>
                    </span>
                  </div>
                )}
                {careerBests.mostRbiInGame && careerBests.mostRbiInGame.value > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-sub1">1試合最多打点</span>
                    <span className="text-xs text-main">
                      <span className="font-bold text-base text-accent mr-1">{careerBests.mostRbiInGame.value}</span>
                      打点
                      <span className="text-sub2 ml-1.5">
                        {formatDate(careerBests.mostRbiInGame.date)} vs {careerBests.mostRbiInGame.opponent}
                      </span>
                    </span>
                  </div>
                )}
                {careerBests.longestHitStreak >= 2 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-sub1">最長連続試合安打</span>
                    <span className="text-xs text-main">
                      <span className="font-bold text-base text-accent mr-1">{careerBests.longestHitStreak}</span>
                      試合
                      {careerBests.currentHitStreak === careerBests.longestHitStreak && (
                        <span className="text-pos-t ml-1.5 font-semibold">更新中🔥</span>
                      )}
                    </span>
                  </div>
                )}
                {careerBests.bestSeasonAvg && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-sub1">シーズン最高打率</span>
                    <span className="text-xs text-main">
                      <span className={`font-bold text-base mr-1 ${avgColor(careerBests.bestSeasonAvg.value)}`}>
                        {fmtAvg(careerBests.bestSeasonAvg.value)}
                      </span>
                      <span className="text-sub2">{careerBests.bestSeasonAvg.season}年</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 直近5試合成績サマリー */}
          {recentAtBats.length > 0 && (
            <div className={`${card} p-5`}>
              <h2 className={`${sectionTitle} mb-3`}>直近{recentN}試合</h2>
              {/* FX-2: gap-2 + フォント縮小でフォント幅増大テーマでも1行に収める */}
              <div className="flex items-end gap-2 flex-wrap">
                <div>
                  <div className={`text-xl font-bold truncate ${avgColor(recentStats.avg)}`}>{fmtAvg(recentStats.avg)}</div>
                  <div className={subLabel}>打率</div>
                </div>
                {avgDiff !== null && (
                  <div className={`text-xs font-semibold mb-1 ${diffClass}`}>{diffLabel}</div>
                )}
                <div className="text-center">
                  <div className="text-base font-bold text-main">{recentStats.hits}-{recentStats.ab}</div>
                  <div className={subLabel}>安打-打数</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-main">{recentStats.hrs}</div>
                  <div className={subLabel}>本塁打</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-main">{recentStats.rbi}</div>
                  <div className={subLabel}>打点</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-main">{recentStats.sb}</div>
                  <div className={subLabel}>盗塁</div>
                </div>
              </div>
            </div>
          )}

          {/* 投手成績 */}
          {pitchingStats.length > 0 && (
            <div className={`${card} p-6`}>
              <h2 className={`${sectionTitle} mb-4`}>投手成績</h2>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center min-w-0"><div className={bigStat}>{fmtERA(pStats.era)}</div><div className={subLabel}>防御率</div></div>
                <div className="text-center min-w-0"><div className={bigStat}>{fmtDec(pStats.whip, 2)}</div><div className={subLabel}>WHIP</div></div>
                <div className="text-center min-w-0"><div className={bigStat}>{pStats.strikeouts}</div><div className={subLabel}>奪三振</div></div>
                <div className="text-center min-w-0"><div className={bigStat}>{formatIP(pStats.innings_pitched)}</div><div className={subLabel}>投球回</div></div>
              </div>
              <div className={`grid grid-cols-5 gap-2 pt-4 ${divider} text-center text-sm`}>
                <div><div className={smallVal}>{pStats.games}</div><div className={smallLabel}>登板</div></div>
                <div><div className={smallVal}>{pStats.wins}</div><div className={smallLabel}>勝</div></div>
                <div><div className={smallVal}>{pStats.losses}</div><div className={smallLabel}>敗</div></div>
                <div><div className={smallVal}>{pStats.saves}</div><div className={smallLabel}>S</div></div>
                <div><div className={smallVal}>{pStats.holds}</div><div className={smallLabel}>H</div></div>
              </div>
              {/* M8-6: 直近登板サマリ */}
              {recentPitching.length > 0 && (
                <div className={`pt-4 mt-4 ${divider}`}>
                  <p className="text-xs text-sub2 mb-2">直近の登板</p>
                  <div className="space-y-2">
                    {recentPitching.map(({ game, ps }) => {
                      const resultEmoji = ps.result === 'win' ? '○' : ps.result === 'loss' ? '●' : ps.result === 'save' ? 'S' : ps.result === 'hold' ? 'H' : '-'
                      const resultClass = ps.result === 'win' ? 'text-pos-t' : ps.result === 'loss' ? 'text-neg-t' : 'text-sub2'
                      return (
                        <Link
                          key={ps.id}
                          href={`/games/${game.id}`}
                          className="flex items-center justify-between rounded-lg bg-lv2 px-3 py-2 hover:bg-s2 transition-colors"
                        >
                          <div className="text-xs text-sub1">
                            <span className="text-sub2">{formatDate(game.game_date)}</span>
                            <span className="ml-1.5">vs {game.opponent}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-sub1">{formatIP(ps.innings_pitched)}回 {ps.earned_runs}失</span>
                            <span className={`font-bold ${resultClass}`}>{resultEmoji}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右カラム: 直近試合 */}
        <div className="lg:col-span-1">
          <div className={`${card} p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={sectionTitle}>直近の試合</h2>
              <Link href="/games" className="text-sm text-accent hover:underline">全て →</Link>
            </div>
            {recentGames.length === 0 ? (
              <p className="text-sub2 text-center py-4">試合が登録されていません</p>
            ) : (
              <div className="divide-y divide-s2">
                {recentGames.map((game) => {
                  const gameStats = calcBattingStats(game.at_bats)
                  return (
                    <div key={game.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ScoreDisplay game={game} />
                        <div>
                          <span className="text-sm font-medium text-main">vs {game.opponent}</span>
                          <div className="text-xs text-sub2 mt-0.5">{formatDate(game.game_date)}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-sm">
                        {game.at_bats.length > 0 ? (
                          <span className="font-medium text-main">
                            {gameStats.hits}/{gameStats.ab}
                            {gameStats.hrs > 0 && <span className="text-accent ml-1">{gameStats.hrs}HR</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-sub2">打席なし</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
