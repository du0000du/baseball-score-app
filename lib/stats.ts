import type { AtBat, BattingStats } from './supabase/types'

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
  const rbi = atBats.filter(ab => ab.is_rbi).length
  const runs = atBats.filter(ab => ab.is_run).length
  const sb = atBats.filter(ab => ab.is_stolen_base).length
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
