// ────────────────────────────────────────────────
// 打席結果の短縮コード
//   成績まとめ編集グリッドで、1セル＝1打席を短い文字で入出力するための変換。
//   末尾の数字は打点として解釈する（例: 「本2」＝本塁打・打点2）。
// ────────────────────────────────────────────────

import type { ResultType } from './supabase/types'
import { toHalfWidth } from './bulk-parse'

/** result_type → 表示コード（グリッドに出す正式表記） */
export const RESULT_CODE: Record<ResultType, string> = {
  hit: '安',
  double: '二',
  triple: '三',
  hr: '本',
  strikeout: '振',
  groundout: 'ゴ',
  outfield_groundout: '外ゴ',
  flyout: '飛',
  infield_flyout: '内飛',
  liner_out: 'ラ',
  foul_flyout: '邪飛',
  walk: '四',
  hbp: '死',
  sac_bunt: '犠',
  sac_fly: '犠飛',
  error: '失',
  fc: '選',
}

/**
 * 入力の揺れを吸収するための別名表。
 * 長い表記から先に判定するため、照合時に文字数の降順へ並べ替える。
 */
type CodeAlias = { alias: string; type: ResultType }

const CODE_ALIASES: CodeAlias[] = ([
  { alias: '安', type: 'hit' }, { alias: 'ヒ', type: 'hit' }, { alias: 'ヒット', type: 'hit' },
  { alias: '単', type: 'hit' }, { alias: '単打', type: 'hit' }, { alias: 'h', type: 'hit' },
  { alias: '二', type: 'double' }, { alias: '二塁打', type: 'double' }, { alias: '2b', type: 'double' },
  { alias: '三', type: 'triple' }, { alias: '三塁打', type: 'triple' }, { alias: '3b', type: 'triple' },
  { alias: '本', type: 'hr' }, { alias: '本塁打', type: 'hr' }, { alias: 'hr', type: 'hr' },
  { alias: 'ホームラン', type: 'hr' },
  { alias: '振', type: 'strikeout' }, { alias: '三振', type: 'strikeout' }, { alias: 'k', type: 'strikeout' },
  { alias: '外ゴ', type: 'outfield_groundout' }, { alias: '外野ゴロ', type: 'outfield_groundout' },
  { alias: 'ゴ', type: 'groundout' }, { alias: 'ゴロ', type: 'groundout' },
  { alias: '内ゴ', type: 'groundout' }, { alias: '内野ゴロ', type: 'groundout' }, { alias: 'g', type: 'groundout' },
  { alias: '内飛', type: 'infield_flyout' }, { alias: '内野フライ', type: 'infield_flyout' },
  { alias: '邪飛', type: 'foul_flyout' }, { alias: '邪', type: 'foul_flyout' },
  { alias: 'ファールフライ', type: 'foul_flyout' },
  { alias: '犠飛', type: 'sac_fly' }, { alias: 'sf', type: 'sac_fly' },
  { alias: '犠', type: 'sac_bunt' }, { alias: '犠打', type: 'sac_bunt' },
  { alias: 'バント', type: 'sac_bunt' }, { alias: 'sh', type: 'sac_bunt' },
  { alias: '飛', type: 'flyout' }, { alias: 'フライ', type: 'flyout' },
  { alias: '外飛', type: 'flyout' }, { alias: '外野フライ', type: 'flyout' }, { alias: 'f', type: 'flyout' },
  { alias: 'ラ', type: 'liner_out' }, { alias: 'ライナー', type: 'liner_out' }, { alias: 'l', type: 'liner_out' },
  { alias: '四', type: 'walk' }, { alias: '四球', type: 'walk' }, { alias: 'bb', type: 'walk' },
  { alias: 'w', type: 'walk' },
  { alias: '死', type: 'hbp' }, { alias: '死球', type: 'hbp' }, { alias: 'hbp', type: 'hbp' },
  { alias: '失', type: 'error' }, { alias: 'エラー', type: 'error' }, { alias: 'e', type: 'error' },
  { alias: '選', type: 'fc' }, { alias: '野選', type: 'fc' }, { alias: 'fc', type: 'fc' },
] as CodeAlias[]).sort((a, b) => b.alias.length - a.alias.length)

export interface ParsedAtBat {
  result_type: ResultType
  rbi: number
}

/**
 * セル文字列を打席結果に変換する。
 * 解釈できない場合は null（呼び出し側でエラー表示する）。
 */
export function parseAtBatCode(input: string): ParsedAtBat | null {
  const s = toHalfWidth(input).trim()
  if (!s) return null

  // 末尾の数字を打点として切り出す
  const m = s.match(/^(.*?)(\d+)$/)
  const body = (m ? m[1] : s).trim()
  const rbi = m ? parseInt(m[2], 10) : 0
  if (!body) return null

  const lower = body.toLowerCase()
  for (const { alias, type } of CODE_ALIASES) {
    if (lower === alias.toLowerCase()) {
      return { result_type: type, rbi: Math.max(0, Math.min(rbi, 9)) }
    }
  }
  return null
}

/** 打席結果をセル表示用の文字列にする */
export function formatAtBatCode(result: ResultType, rbi: number): string {
  const code = RESULT_CODE[result] ?? ''
  return rbi > 0 ? `${code}${rbi}` : code
}

/** 打数に数える結果か（四死球・犠打・犠飛は打数に含めない） */
export function countsAsAtBat(result: ResultType): boolean {
  return !['walk', 'hbp', 'sac_bunt', 'sac_fly'].includes(result)
}

/** 出塁した結果か（得点の割り当て推定に使う） */
export function reachedBase(result: ResultType): boolean {
  return ['hit', 'double', 'triple', 'hr', 'walk', 'hbp', 'error', 'fc'].includes(result)
}

/** 入力補助用の凡例（UIに表示する） */
export const CODE_LEGEND: { code: string; label: string }[] = [
  { code: '安', label: '単打' },
  { code: '二', label: '二塁打' },
  { code: '三', label: '三塁打' },
  { code: '本', label: '本塁打' },
  { code: '振', label: '三振' },
  { code: 'ゴ', label: '内野ゴロ' },
  { code: '外ゴ', label: '外野ゴロ' },
  { code: '飛', label: '外野フライ' },
  { code: '内飛', label: '内野フライ' },
  { code: 'ラ', label: 'ライナー' },
  { code: '邪飛', label: 'ファールフライ' },
  { code: '四', label: '四球' },
  { code: '死', label: '死球' },
  { code: '犠', label: '犠打' },
  { code: '犠飛', label: '犠飛' },
  { code: '失', label: 'エラー' },
  { code: '選', label: '野選' },
]
