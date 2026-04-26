export type ResultType =
  | 'hit' | 'double' | 'triple' | 'hr'
  | 'strikeout' | 'groundout' | 'flyout'
  | 'walk' | 'hbp' | 'sac_bunt' | 'sac_fly'
  | 'error' | 'fc'

export type HitType = 'single' | 'double' | 'triple' | 'hr'
export type Direction = 'left' | 'left_center' | 'center' | 'right_center' | 'right'
export type GameResult = 'win' | 'loss' | 'draw'

export interface User {
  id: string
  name: string | null
  position: string | null
  team_name: string | null
  created_at: string
}

export interface Game {
  id: string
  user_id: string
  game_date: string
  opponent: string
  result: GameResult
  score_us: number
  score_them: number
  stadium: string | null
  notes: string | null
  season: number
  created_at: string
}

export interface AtBat {
  id: string
  game_id: string
  user_id: string
  at_bat_number: number
  batting_order: number
  result_type: ResultType
  hit_type: HitType | null
  direction: Direction | null
  is_rbi: boolean
  is_run: boolean
  is_stolen_base: boolean
  is_caught_stealing: boolean
  is_error: boolean
  input_method: 'manual' | 'nlp'
  created_at: string
}

export interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

// 成績集計
export interface BattingStats {
  pa: number        // 打席数
  ab: number        // 打数
  hits: number      // 安打
  singles: number   // 単打
  doubles: number   // 二塁打
  triples: number   // 三塁打
  hrs: number       // 本塁打
  tb: number        // 塁打数
  strikeouts: number
  walks: number
  hbp: number
  sac_bunt: number
  sac_fly: number
  rbi: number
  runs: number
  sb: number        // 盗塁
  cs: number        // 盗塁死
  errors: number
  avg: number | null
  obp: number | null
  slg: number | null
  ops: number | null
  isod: number | null
  isop: number | null
  sb_pct: number | null
  rc27: number | null
}

export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  hit: '単打',
  double: '二塁打',
  triple: '三塁打',
  hr: '本塁打',
  strikeout: '三振',
  groundout: '内野ゴロ',
  flyout: '外野フライ',
  walk: '四球',
  hbp: '死球',
  sac_bunt: '犠打',
  sac_fly: '犠飛',
  error: 'エラー',
  fc: 'FC',
}

export const DIRECTION_LABELS: Record<Direction, string> = {
  left: 'レフト',
  left_center: '左中間',
  center: 'センター',
  right_center: '右中間',
  right: 'ライト',
}

export const RESULT_TYPE_SHORT: Record<ResultType, string> = {
  hit: '右安',
  double: '右二',
  triple: '右三',
  hr: '本塁',
  strikeout: '三振',
  groundout: '内ゴ',
  flyout: '外飛',
  walk: '四球',
  hbp: '死球',
  sac_bunt: '犠打',
  sac_fly: '犠飛',
  error: '失策',
  fc: 'FC',
}
