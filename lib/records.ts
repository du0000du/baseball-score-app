import { calcBattingStats } from './stats'
import type { AtBat, BattingStats, Game } from './supabase/types'

export interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

const HIT_RESULTS = ['hit', 'double', 'triple', 'hr']

export function gameHasHit(g: GameWithAtBats): boolean {
  return g.at_bats.some(ab => HIT_RESULTS.includes(ab.result_type))
}

// 打率・OPS など率系指標を評価するための最低打席数
// 草野球は1シーズンの打席数が少ないため、20打席では大半のシーズンが比較対象外になる。
export const MIN_PA_FOR_RATE = 10

// ────────────────────────────────────────────────
// 次のマイルストーン（今季成績を分析して動的に算出）
//   固定閾値（5本塁打など）だと現在値から遠すぎたり既に通過済みだったりするため、
//   今の値の「1つ上の節目」を都度求める。
// ────────────────────────────────────────────────
export type MilestoneKind = 'count' | 'rate'

export interface NextMilestone {
  id: string
  label: string
  emoji: string
  kind: MilestoneKind
  current: number
  target: number
  remainingText: string
  progress: number
  hint: string | null
}

const COUNT_LADDERS: Record<string, number[]> = {
  hits: [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100],
  hrs:  [1, 2, 3, 5, 7, 10, 15, 20, 30],
  rbi:  [1, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100],
  sb:   [1, 3, 5, 10, 15, 20, 30],
  pa:   [10, 25, 50, 75, 100, 150, 200],
}

const RATE_LADDERS: Record<string, number[]> = {
  avg: [0.200, 0.250, 0.280, 0.300, 0.320, 0.350, 0.400],
  ops: [0.600, 0.700, 0.800, 0.900, 1.000, 1.100],
}

function nextFromCountLadder(current: number, ladder: number[]): number | null {
  for (const t of ladder) if (current < t) return t
  // 梯子を超えたら以降は25刻みの節目
  const step = 25
  return (Math.floor(current / step) + 1) * step
}

function nextFromRateLadder(current: number, ladder: number[]): number | null {
  for (const t of ladder) if (current < t) return t
  return null
}

/**
 * 目標打率に到達するために必要な「連続安打数」
 * (hits + h) / (ab + h) >= target を h について解く
 */
export function hitsNeededForAvg(hits: number, ab: number, target: number): number | null {
  if (target >= 1) return null
  const h = (target * ab - hits) / (1 - target)
  if (h <= 0) return 0
  return Math.ceil(h)
}

/** 直近N試合の1試合あたりペース */
export interface Pace {
  games: number
  hits: number
  hrs: number
  rbi: number
  sb: number
}

export function calcRecentPace(games: GameWithAtBats[], n = 5): Pace | null {
  // 打席のある試合だけを新しい順に n 件
  const withAtBats = games.filter(g => g.at_bats.length > 0)
  const recent = withAtBats.slice(0, n)
  if (recent.length === 0) return null
  const s = calcBattingStats(recent.flatMap(g => g.at_bats))
  return {
    games: recent.length,
    hits: s.hits / recent.length,
    hrs:  s.hrs / recent.length,
    rbi:  s.rbi / recent.length,
    sb:   s.sb / recent.length,
  }
}

function paceHint(remaining: number, perGame: number): string | null {
  if (perGame <= 0) return null
  const g = Math.ceil(remaining / perGame)
  if (g > 30) return null
  return `直近ペースなら約${g}試合`
}

/**
 * 今季成績から「次に狙える節目」を算出する。
 * 達成率が高い（＝あと少しで届く）順に返す。
 */
export function computeNextMilestones(
  stats: BattingStats,
  pace: Pace | null,
  limit = 4,
): NextMilestone[] {
  const out: NextMilestone[] = []

  const counts: { id: string; emoji: string; unit: string; value: number; key: string; paceKey: keyof Pace | null }[] = [
    { id: 'hits', emoji: '🎯', unit: '本',   value: stats.hits, key: 'hits', paceKey: 'hits' },
    { id: 'hrs',  emoji: '💪', unit: '本',   value: stats.hrs,  key: 'hrs',  paceKey: 'hrs'  },
    { id: 'rbi',  emoji: '⚡', unit: '打点', value: stats.rbi,  key: 'rbi',  paceKey: 'rbi'  },
    { id: 'sb',   emoji: '💨', unit: '個',   value: stats.sb,   key: 'sb',   paceKey: 'sb'   },
    { id: 'pa',   emoji: '📋', unit: '打席', value: stats.pa,   key: 'pa',   paceKey: null   },
  ]

  const LABELS: Record<string, string> = {
    hits: '安打', hrs: '本塁打', rbi: '打点', sb: '盗塁', pa: '打席',
  }

  for (const c of counts) {
    // まだ1つも記録がない項目は「次の節目」として出さない（0本塁打で「1本塁打まであと1本」は情報量が乏しい）
    if (c.value === 0 && c.id !== 'hits' && c.id !== 'pa') continue
    const target = nextFromCountLadder(c.value, COUNT_LADDERS[c.key])
    if (target === null) continue
    const remaining = target - c.value
    const perGame = c.paceKey && pace ? pace[c.paceKey] as number : 0
    out.push({
      id: `season_${c.id}`,
      // 「今季10安打」のように単位を重ねない（単位は残り表示側で使う）
      label: `今季${target}${LABELS[c.key]}`,
      emoji: c.emoji,
      kind: 'count',
      current: c.value,
      target,
      remainingText: `あと${remaining}${c.unit}`,
      progress: target > 0 ? Math.min(1, c.value / target) : 0,
      hint: paceHint(remaining, perGame),
    })
  }

  // 率系は最低打席数を満たすときのみ
  if (stats.pa >= MIN_PA_FOR_RATE) {
    if (stats.avg !== null) {
      const target = nextFromRateLadder(stats.avg, RATE_LADDERS.avg)
      if (target !== null) {
        const need = hitsNeededForAvg(stats.hits, stats.ab, target)
        out.push({
          id: 'season_avg',
          label: `今季打率${target.toFixed(3).replace(/^0/, '')}`,
          emoji: '🏆',
          kind: 'rate',
          current: stats.avg,
          target,
          remainingText: `あと${(target - stats.avg).toFixed(3).replace(/^0/, '')}`,
          progress: Math.min(1, stats.avg / target),
          hint: need !== null && need > 0 ? `連続${need}安打で到達` : null,
        })
      }
    }
    if (stats.ops !== null) {
      const target = nextFromRateLadder(stats.ops, RATE_LADDERS.ops)
      if (target !== null) {
        out.push({
          id: 'season_ops',
          label: `今季OPS${target.toFixed(3).replace(/^0/, '')}`,
          emoji: '📈',
          kind: 'rate',
          current: stats.ops,
          target,
          remainingText: `あと${(target - stats.ops).toFixed(3).replace(/^0/, '')}`,
          progress: Math.min(1, stats.ops / target),
          hint: null,
        })
      }
    }
  }

  return out.sort((a, b) => b.progress - a.progress).slice(0, limit)
}

// ────────────────────────────────────────────────
// シーズン別集計とシーズンベスト
// ────────────────────────────────────────────────
export interface SeasonAgg {
  season: number
  stats: BattingStats
  games: number
}

export function aggregateBySeason(careerGames: GameWithAtBats[]): SeasonAgg[] {
  const map = new Map<number, GameWithAtBats[]>()
  for (const g of careerGames) {
    const list = map.get(g.season) ?? []
    list.push(g)
    map.set(g.season, list)
  }
  const out: SeasonAgg[] = []
  map.forEach((gs, season) => {
    out.push({
      season,
      stats: calcBattingStats(gs.flatMap(g => g.at_bats)),
      games: gs.filter(g => g.at_bats.length > 0).length,
    })
  })
  return out.sort((a, b) => b.season - a.season)
}

export interface SeasonBestEntry {
  key: string
  label: string
  kind: MilestoneKind
  current: number | null
  best: number | null
  bestSeason: number | null
  /** 今季が自己最高（またはタイ）かどうか */
  isCurrentBest: boolean
}

/**
 * 各指標について「今季の値」と「歴代シーズンベスト」を並べる。
 * 率系は MIN_PA_FOR_RATE 未満のシーズンを除外して誤解を防ぐ。
 */
export function computeSeasonBests(
  seasons: SeasonAgg[],
  currentSeason: number,
): SeasonBestEntry[] {
  const cur = seasons.find(s => s.season === currentSeason) ?? null

  const defs: { key: string; label: string; kind: MilestoneKind; pick: (s: BattingStats) => number | null }[] = [
    { key: 'avg',  label: '打率',   kind: 'rate',  pick: s => s.avg },
    { key: 'ops',  label: 'OPS',    kind: 'rate',  pick: s => s.ops },
    { key: 'hits', label: '安打',   kind: 'count', pick: s => s.hits },
    { key: 'hrs',  label: '本塁打', kind: 'count', pick: s => s.hrs },
    { key: 'rbi',  label: '打点',   kind: 'count', pick: s => s.rbi },
    { key: 'sb',   label: '盗塁',   kind: 'count', pick: s => s.sb },
  ]

  return defs.map(d => {
    const eligible = seasons.filter(s => d.kind === 'count' || s.stats.pa >= MIN_PA_FOR_RATE)
    let best: number | null = null
    let bestSeason: number | null = null
    for (const s of eligible) {
      const v = d.pick(s.stats)
      if (v === null) continue
      if (best === null || v > best) { best = v; bestSeason = s.season }
    }
    const currentEligible = cur !== null && (d.kind === 'count' || cur.stats.pa >= MIN_PA_FOR_RATE)
    const current = cur && currentEligible ? d.pick(cur.stats) : null
    return {
      key: d.key,
      label: d.label,
      kind: d.kind,
      current,
      best,
      bestSeason,
      isCurrentBest: best !== null && current !== null && current >= best && bestSeason === currentSeason,
    }
  })
}

// ────────────────────────────────────────────────
// 通算ベスト（1試合記録・連続記録）
// ────────────────────────────────────────────────
export interface CareerBests {
  mostHitsInGame: { value: number; date: string; opponent: string } | null
  mostRbiInGame:  { value: number; date: string; opponent: string } | null
  longestHitStreak: number
  currentHitStreak: number
  bestSeasonAvg: { season: number; value: number } | null
  careerStats: BattingStats
}

/** careerGames は game_date 昇順（古い順）で渡すこと */
export function computeCareerBests(
  careerGames: GameWithAtBats[],
  seasons: SeasonAgg[],
): CareerBests {
  const withAtBats = careerGames.filter(g => g.at_bats.length > 0)

  let mostHitsInGame: CareerBests['mostHitsInGame'] = null
  let mostRbiInGame: CareerBests['mostRbiInGame'] = null
  for (const g of withAtBats) {
    const s = calcBattingStats(g.at_bats)
    if (mostHitsInGame === null || s.hits > mostHitsInGame.value) {
      mostHitsInGame = { value: s.hits, date: g.game_date, opponent: g.opponent }
    }
    if (mostRbiInGame === null || s.rbi > mostRbiInGame.value) {
      mostRbiInGame = { value: s.rbi, date: g.game_date, opponent: g.opponent }
    }
  }

  let longestHitStreak = 0
  let running = 0
  for (const g of withAtBats) {
    running = gameHasHit(g) ? running + 1 : 0
    if (running > longestHitStreak) longestHitStreak = running
  }
  // 現在継続中のストリーク（末尾から遡る）
  let currentHitStreak = 0
  for (let i = withAtBats.length - 1; i >= 0; i--) {
    if (gameHasHit(withAtBats[i])) currentHitStreak++
    else break
  }

  let bestSeasonAvg: CareerBests['bestSeasonAvg'] = null
  for (const s of seasons) {
    if (s.stats.pa < MIN_PA_FOR_RATE || s.stats.avg === null) continue
    if (bestSeasonAvg === null || s.stats.avg > bestSeasonAvg.value) {
      bestSeasonAvg = { season: s.season, value: s.stats.avg }
    }
  }

  return {
    mostHitsInGame,
    mostRbiInGame,
    longestHitStreak,
    currentHitStreak,
    bestSeasonAvg,
    careerStats: calcBattingStats(careerGames.flatMap(g => g.at_bats)),
  }
}

// ────────────────────────────────────────────────
// 直近ペースから「狙えそうな記録」を提案
// ────────────────────────────────────────────────
export interface Recommendation {
  id: string
  emoji: string
  title: string
  detail: string
  gamesNeeded: number
}

const REACHABLE_GAMES = 12   // これ以上かかる記録は「狙える」とは言わない

export function computeRecommendations(
  currentStats: BattingStats,
  seasons: SeasonAgg[],
  currentSeason: number,
  careerBests: CareerBests,
  pace: Pace | null,
  limit = 3,
): Recommendation[] {
  if (!pace) return []
  const out: Recommendation[] = []

  const pastSeasons = seasons.filter(s => s.season !== currentSeason)

  const defs: { key: keyof Pace & string; label: string; unit: string; emoji: string; current: number; pick: (s: BattingStats) => number }[] = [
    { key: 'hits', label: '安打',   unit: '本',   emoji: '🎯', current: currentStats.hits, pick: s => s.hits },
    { key: 'hrs',  label: '本塁打', unit: '本',   emoji: '💪', current: currentStats.hrs,  pick: s => s.hrs  },
    { key: 'rbi',  label: '打点',   unit: '打点', emoji: '⚡', current: currentStats.rbi,  pick: s => s.rbi  },
    { key: 'sb',   label: '盗塁',   unit: '個',   emoji: '💨', current: currentStats.sb,   pick: s => s.sb   },
  ]

  for (const d of defs) {
    const perGame = pace[d.key] as number
    if (perGame <= 0) continue

    // 過去シーズンの自己最高を上回るのに必要な数
    const pastBest = pastSeasons.reduce<number | null>((acc, s) => {
      const v = d.pick(s.stats)
      return acc === null || v > acc ? v : acc
    }, null)

    if (pastBest !== null && d.current <= pastBest) {
      const remaining = pastBest - d.current + 1
      const gamesNeeded = Math.ceil(remaining / perGame)
      if (gamesNeeded <= REACHABLE_GAMES) {
        out.push({
          id: `beat_season_${d.key}`,
          emoji: d.emoji,
          title: `シーズン最多${d.label}の更新`,
          detail: `あと${remaining}${d.unit}（自己最高 ${pastBest}${d.unit}）— 直近ペース ${perGame.toFixed(1)}${d.unit}/試合 なら約${gamesNeeded}試合`,
          gamesNeeded,
        })
      }
    }

  }

  // 1試合記録の更新（シーズンが1つしかないユーザーでも成立する提案）
  const singleGame: { key: 'hits' | 'rbi'; label: string; unit: string; emoji: string; best: CareerBests['mostHitsInGame'] }[] = [
    { key: 'hits', label: '1試合最多安打', unit: '本',   emoji: '🎯', best: careerBests.mostHitsInGame },
    { key: 'rbi',  label: '1試合最多打点', unit: '打点', emoji: '⚡', best: careerBests.mostRbiInGame  },
  ]
  for (const sg of singleGame) {
    if (!sg.best || sg.best.value <= 0) continue
    const perGame = pace[sg.key] as number
    if (perGame <= 0) continue
    // 直近ペースが自己最高の半分以上あるなら「次の試合で狙える」と判断
    if (perGame >= sg.best.value / 2) {
      out.push({
        id: `single_${sg.key}`,
        emoji: sg.emoji,
        title: `${sg.label}の更新`,
        detail: `1試合${sg.best.value + 1}${sg.unit}で自己最高を更新（現在の自己最高 ${sg.best.value}${sg.unit}・直近ペース ${perGame.toFixed(1)}${sg.unit}/試合）`,
        gamesNeeded: 1,
      })
    }
  }

  // 打率で自己最高シーズンを超える
  if (currentStats.pa >= MIN_PA_FOR_RATE && currentStats.avg !== null) {
    const pastBestAvg = pastSeasons
      .filter(s => s.stats.pa >= MIN_PA_FOR_RATE && s.stats.avg !== null)
      .reduce<number | null>((acc, s) => (acc === null || s.stats.avg! > acc ? s.stats.avg! : acc), null)
    if (pastBestAvg !== null && currentStats.avg <= pastBestAvg) {
      const need = hitsNeededForAvg(currentStats.hits, currentStats.ab, pastBestAvg + 0.001)
      if (need !== null && need > 0 && pace.hits > 0) {
        const gamesNeeded = Math.ceil(need / pace.hits)
        if (gamesNeeded <= REACHABLE_GAMES) {
          out.push({
            id: 'beat_season_avg',
            emoji: '🏆',
            title: 'シーズン最高打率の更新',
            detail: `連続${need}安打で到達（自己最高 ${pastBestAvg.toFixed(3).replace(/^0/, '')}）`,
            gamesNeeded,
          })
        }
      }
    }
  }

  // 連続試合安打の更新（継続中のときのみ）
  if (careerBests.currentHitStreak >= 2 && careerBests.longestHitStreak > 0) {
    const remaining = careerBests.longestHitStreak - careerBests.currentHitStreak + 1
    if (remaining > 0 && remaining <= 5) {
      out.push({
        id: 'beat_streak',
        emoji: '🔥',
        title: '最長連続試合安打の更新',
        detail: `${careerBests.currentHitStreak}試合継続中 — あと${remaining}試合で自己最長（${careerBests.longestHitStreak}試合）を更新`,
        gamesNeeded: remaining,
      })
    }
  }

  // 近いものから、同一指標が重複しないように選ぶ
  const seen = new Set<string>()
  return out
    .sort((a, b) => a.gamesNeeded - b.gamesNeeded)
    .filter(r => {
      // beat_season_hits / single_hits → いずれも "hits" として扱い重複を避ける
      const metric = r.id.replace(/^(beat_season_|single_)/, '')
      if (seen.has(metric)) return false
      seen.add(metric)
      return true
    })
    .slice(0, limit)
}
