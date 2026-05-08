import type { AtBat, BattingStats, PitchingStat, PitchingStats } from './supabase/types'

export function calcBattingStats(atBats: AtBat[]): BattingStats {
  const pa = atBats.length
  const hits = atBats.filter(ab => ['hit', 'double', 'triple', 'hr'].includes(ab.result_type)).length
  const singles = atBats.filter(ab => ab.result_type === 'hit').length
  const doubles = atBats.filter(ab => ab.result_type === 'double').length
  const triples = atBats.filter(ab => ab.result_type === 'triple').length
  const hrs = atBats.filter(ab => ab.result_type === 'hr').length
  const tb = singles + doubles * 2 + triples * 3 + hrs * 4
  const walks = atBats.filter(ab => ab.result_type === 'walk').length
  const hbp = atBats.filter(ab => ab.result_type === 'hbp').length
  const sac_bunt = atBats.filter(ab => ab.result_type === 'sac_bunt').length
  const sac_fly = atBats.filter(ab => ab.result_type === 'sac_fly').length
  const strikeouts = atBats.filter(ab => ab.result_type === 'strikeout').length
  const errors = atBats.filter(ab => ab.result_type === 'error').length
  const rbi = atBats.reduce((sum, ab) => sum + (ab.rbi_count ?? (ab.is_rbi ? 1 : 0)), 0)
  const runs = atBats.filter(ab => ab.is_run).length
  const sb = atBats.reduce((sum, ab) => sum + (ab.stolen_base_count ?? (ab.is_stolen_base ? 1 : 0)), 0)
  const cs = atBats.filter(ab => ab.is_caught_stealing).length

  const ab = pa - walks - hbp - sac_bunt - sac_fly

  const avg = ab > 0 ? hits / ab : null
  const obp_denom = ab + walks + hbp + sac_fly
  const obp = obp_denom > 0 ? (hits + walks + hbp) / obp_denom : null
  const slg = ab > 0 ? tb / ab : null
  const ops = obp !== null && slg !== null ? obp + slg : null
  const isod = obp !== null && avg !== null ? obp - avg : null
  const isop = slg !== null && avg !== null ? slg - avg : null
  const sb_pct = (sb + cs) > 0 ? sb / (sb + cs) : null

  const rc_denom = ab - hits + cs
  const rc27 = rc_denom > 0 && (ab + walks + hbp) > 0
    ? (((hits + walks + hbp) * tb) / (ab + walks + hbp)) * 27 / rc_denom
    : null

  return {
    pa, ab, hits, singles, doubles, triples, hrs, tb,
    strikeouts, walks, hbp, sac_bunt, sac_fly,
    rbi, runs, sb, cs, errors,
    avg, obp, slg, ops, isod, isop, sb_pct, rc27,
  }
}

// innings_pitched は1/3イニング単位の整数
// 例: 9 = 3.0回, 10 = 3.1回, 11 = 3.2回
// IPをアウト数（1/3単位整数）に変換
export function ipToOuts(ip: number): number {
  return ip
}

// アウト数（1/3単位整数）をイニング表示文字列に変換
export function formatIP(outs: number): string {
  const innings = Math.floor(outs / 3)
  const thirds = outs % 3
  if (thirds === 0) return `${innings}`
  return `${innings}.${thirds}`
}

// アウト数（1/3単位整数）を小数換算イニング数に変換（ERA計算用）
export function outsToIPDecimal(outs: number): number {
  return Math.floor(outs / 3) + (outs % 3) / 3
}

export function calcPitchingStats(stats: PitchingStat[]): PitchingStats {
  const games = stats.length
  const wins = stats.filter(s => s.result === 'win').length
  const losses = stats.filter(s => s.result === 'loss').length
  const saves = stats.filter(s => s.result === 'save').length
  const holds = stats.filter(s => s.result === 'hold').length
  const complete_games = stats.filter(s => s.complete_game).length
  const innings_pitched = stats.reduce((sum, s) => sum + s.innings_pitched, 0)
  const hits_allowed = stats.reduce((sum, s) => sum + s.hits_allowed, 0)
  const home_runs_allowed = stats.reduce((sum, s) => sum + s.home_runs_allowed, 0)
  const strikeouts = stats.reduce((sum, s) => sum + s.strikeouts, 0)
  const walks = stats.reduce((sum, s) => sum + s.walks, 0)
  const hit_batsmen = stats.reduce((sum, s) => sum + s.hit_batsmen, 0)
  const runs_allowed = stats.reduce((sum, s) => sum + s.runs_allowed, 0)
  const earned_runs = stats.reduce((sum, s) => sum + s.earned_runs, 0)
  const hasPitchCount = stats.some(s => s.pitch_count !== null)
  const pitch_count = hasPitchCount
    ? stats.reduce((sum, s) => sum + (s.pitch_count ?? 0), 0)
    : null

  const ipDecimal = outsToIPDecimal(innings_pitched)
  const era = ipDecimal > 0 ? (earned_runs / ipDecimal) * 7 : null
  const whip = ipDecimal > 0 ? (hits_allowed + walks) / ipDecimal : null
  const k9 = ipDecimal > 0 ? (strikeouts / ipDecimal) * 9 : null
  const kbb = walks > 0 ? strikeouts / walks : null
  // FIP = (13*HR + 3*(BB+HBP) - 2*K) / IP + FIP定数(3.10 近似)
  const fip = ipDecimal > 0
    ? (13 * home_runs_allowed + 3 * (walks + hit_batsmen) - 2 * strikeouts) / ipDecimal + 3.10
    : null
  const win_rate = (wins + losses) > 0 ? wins / (wins + losses) : null

  return {
    games, wins, losses, saves, holds, complete_games,
    innings_pitched, hits_allowed, home_runs_allowed,
    strikeouts, walks, hit_batsmen, runs_allowed, earned_runs,
    pitch_count, era, whip, k9, kbb, fip, win_rate,
  }
}

export function fmtAvg(n: number | null): string {
  if (n === null) return '---'
  return n.toFixed(3).replace(/^0/, '')
}

export function fmtPct(n: number | null): string {
  if (n === null) return '---'
  return (n * 100).toFixed(1) + '%'
}

export function fmtDec(n: number | null, d = 2): string {
  if (n === null) return '---'
  return n.toFixed(d)
}

export function fmtERA(n: number | null): string {
  if (n === null) return '---'
  return n.toFixed(2)
}
