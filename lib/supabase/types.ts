export type ResultType =
  | 'hit' | 'double' | 'triple' | 'hr'
  | 'strikeout' | 'groundout' | 'flyout' | 'infield_flyout' | 'liner_out'
  | 'walk' | 'hbp' | 'sac_bunt' | 'sac_fly'
  | 'error' | 'fc'

export type HitType = 'single' | 'double' | 'triple' | 'hr'

// 外野方向
export type OutfieldDirection = 'left' | 'left_center' | 'center' | 'right_center' | 'right'

// 内野守備位置
export type InfieldPosition = 'pitcher' | 'catcher' | 'first_base' | 'second_base' | 'third_base' | 'shortstop'

export type Direction = OutfieldDirection | InfieldPosition

export type GameResult = 'win' | 'loss' | 'draw'

export type PitchingResult = 'win' | 'loss' | 'save' | 'hold' | 'none'

// 守備ポジション（DH含む10種）
export type FieldingPosition =
  | 'pitcher' | 'catcher'
  | 'first_base' | 'second_base' | 'third_base' | 'shortstop'
  | 'left' | 'center' | 'right'
  | 'dh'

export const FIELDING_POSITIONS: { value: FieldingPosition; label: string; full: string }[] = [
  { value: 'pitcher',     label: '投',  full: '投手' },
  { value: 'catcher',     label: '捕',  full: '捕手' },
  { value: 'first_base',  label: '一',  full: '一塁' },
  { value: 'second_base', label: '二',  full: '二塁' },
  { value: 'third_base',  label: '三',  full: '三塁' },
  { value: 'shortstop',   label: '遊',  full: '遊撃' },
  { value: 'left',        label: '左',  full: '左翼' },
  { value: 'center',      label: '中',  full: '中堅' },
  { value: 'right',       label: '右',  full: '右翼' },
  { value: 'dh',          label: 'DH', full: 'DH' },
]

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
  rbi_count: number
  is_run: boolean
  is_stolen_base: boolean
  stolen_base_count: number
  is_caught_stealing: boolean
  is_error: boolean
  input_method: 'manual' | 'nlp'
  fielding_position: FieldingPosition | null
  count_balls: number | null        // N-3: 最終ボールカウント（任意）
  count_strikes: number | null      // N-3: 最終ストライクカウント（任意）
  created_at: string
}

export interface PitchingStat {
  id: string
  game_id: string
  user_id: string
  innings_pitched: number  // 1/3単位の整数 (3イニング=9, 3.1=10, 3.2=11)
  result: PitchingResult
  hits_allowed: number
  home_runs_allowed: number
  strikeouts: number
  walks: number
  hit_batsmen: number
  runs_allowed: number
  earned_runs: number
  complete_game: boolean
  pitch_count: number | null
  created_at: string
}

export interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

export interface GameWithPitching extends Game {
  pitching_stats: PitchingStat[]
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

export interface PitchingStats {
  games: number
  wins: number
  losses: number
  saves: number
  holds: number
  complete_games: number
  innings_pitched: number   // 1/3単位整数
  hits_allowed: number
  home_runs_allowed: number
  strikeouts: number
  walks: number
  hit_batsmen: number
  runs_allowed: number
  earned_runs: number
  pitch_count: number | null
  era: number | null
  whip: number | null
  k9: number | null
  kbb: number | null
  fip: number | null
  baa: number | null   // H8-3: 被打率（簡易式）
  win_rate: number | null
}

export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  hit: '単打',
  double: '二塁打',
  triple: '三塁打',
  hr: '本塁打',
  strikeout: '三振',
  groundout: '内野ゴロ',
  flyout: '外野フライ',
  infield_flyout: '内野フライ',
  liner_out: 'ライナー',
  walk: '四球',
  hbp: '死球',
  sac_bunt: '犠打',
  sac_fly: '犠飛',
  error: 'エラー',
  fc: 'FC',
}

export const OUTFIELD_DIRECTION_LABELS: Record<OutfieldDirection, string> = {
  left: 'レフト',
  left_center: '左中間',
  center: 'センター',
  right_center: '右中間',
  right: 'ライト',
}

export const INFIELD_POSITION_LABELS: Record<InfieldPosition, string> = {
  pitcher: 'ピッチャー',
  catcher: 'キャッチャー',
  first_base: 'ファースト',
  second_base: 'セカンド',
  third_base: 'サード',
  shortstop: 'ショート',
}

export const DIRECTION_LABELS: Record<Direction, string> = {
  ...OUTFIELD_DIRECTION_LABELS,
  ...INFIELD_POSITION_LABELS,
}

// 内野ゴロ時の守備位置ラベル（「〇ゴロ」形式）
export const GROUNDOUT_POSITION_LABELS: Record<InfieldPosition, string> = {
  pitcher: 'ピッチャーゴロ',
  catcher: 'キャッチャーゴロ',
  first_base: 'ファーストゴロ',
  second_base: 'セカンドゴロ',
  third_base: 'サードゴロ',
  shortstop: 'ショートゴロ',
}

// 内野フライ時の守備位置ラベル（「〇フライ」形式）
export const INFIELD_FLY_POSITION_LABELS: Record<InfieldPosition, string> = {
  pitcher: 'ピッチャーフライ',
  catcher: 'キャッチャーフライ',
  first_base: 'ファーストフライ',
  second_base: 'セカンドフライ',
  third_base: 'サードフライ',
  shortstop: 'ショートフライ',
}

// FC時の守備位置ラベル（「〇FC」形式）
export const FC_POSITION_LABELS: Record<InfieldPosition, string> = {
  pitcher: 'ピッチャーFC',
  catcher: 'キャッチャーFC',
  first_base: 'ファーストFC',
  second_base: 'セカンドFC',
  third_base: 'サードFC',
  shortstop: 'ショートFC',
}

// 単打時の打球方向ラベル（「〇安打」形式）
export const HIT_DIRECTION_LABELS: Record<OutfieldDirection, string> = {
  left: 'レフト安打',
  left_center: '左中間安打',
  center: 'センター安打',
  right_center: '右中間安打',
  right: 'ライト安打',
}

// 内野安打時の守備位置ラベル（「〇内野安打」形式）
export const INFIELD_HIT_POSITION_LABELS: Partial<Record<InfieldPosition, string>> = {
  pitcher:     'ピッチャー内野安打',
  catcher:     'キャッチャー内野安打',
  first_base:  'ファースト内野安打',
  second_base: 'セカンド内野安打',
  shortstop:   'ショート内野安打',
}

export const RESULT_TYPE_SHORT: Record<ResultType, string> = {
  hit: '右安',
  double: '右二',
  triple: '三塁',
  hr: '本塁',
  strikeout: '三振',
  groundout: '内ゴ',
  flyout: '外飛',
  infield_flyout: '内飛',
  liner_out: 'ライナ',
  walk: '四球',
  hbp: '死球',
  sac_bunt: '犠打',
  sac_fly: '犠飛',
  error: '失策',
  fc: 'FC',
}

export const INFIELD_POSITIONS: InfieldPosition[] = [
  'pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop',
]

export function isInfieldPosition(d: Direction | null): d is InfieldPosition {
  return d !== null && (INFIELD_POSITIONS as string[]).includes(d)
}

// エラー時の守備位置ラベル（「〇エラー」形式）
export const ERROR_POSITION_LABELS: Partial<Record<Direction, string>> = {
  pitcher:     'ピッチャーエラー',
  catcher:     'キャッチャーエラー',
  first_base:  'ファーストエラー',
  second_base: 'セカンドエラー',
  third_base:  'サードエラー',
  shortstop:   'ショートエラー',
  left:        'レフトエラー',
  center:      'センターエラー',
  right:       'ライトエラー',
}

// ライナーアウト守備位置ラベル
export const LINER_OUT_LABELS: Partial<Record<Direction, string>> = {
  pitcher:     'ピッチャーライナー',
  first_base:  'ファーストライナー',
  second_base: 'セカンドライナー',
  third_base:  'サードライナー',
  shortstop:   'ショートライナー',
  left:        'レフトライナー',
  center:      'センターライナー',
  right:       'ライトライナー',
}

// 打席結果の表示ラベル（守備位置付き）
export function getAtBatLabel(resultType: ResultType, direction: Direction | null): string {
  if (resultType === 'groundout' && isInfieldPosition(direction)) {
    return GROUNDOUT_POSITION_LABELS[direction]
  }
  if (resultType === 'infield_flyout' && isInfieldPosition(direction)) {
    return INFIELD_FLY_POSITION_LABELS[direction]
  }
  if (resultType === 'liner_out' && direction && LINER_OUT_LABELS[direction]) {
    return LINER_OUT_LABELS[direction]!
  }
  if (resultType === 'error' && direction && ERROR_POSITION_LABELS[direction]) {
    return ERROR_POSITION_LABELS[direction]!
  }
  if (resultType === 'hit' && direction) {
    if (!isInfieldPosition(direction)) {
      return HIT_DIRECTION_LABELS[direction as OutfieldDirection] ?? RESULT_TYPE_LABELS[resultType]
    } else if (INFIELD_HIT_POSITION_LABELS[direction as InfieldPosition]) {
      return INFIELD_HIT_POSITION_LABELS[direction as InfieldPosition]!
    }
  }
  if (resultType === 'fc' && isInfieldPosition(direction)) {
    return FC_POSITION_LABELS[direction]
  }
  return RESULT_TYPE_LABELS[resultType]
}
