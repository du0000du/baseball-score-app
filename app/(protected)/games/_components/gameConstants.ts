import type { AtBat } from '@/lib/supabase/types'

export type TagStyle = { label: string; bg: string; text: string }

export const RESULT_TAG: Record<AtBat['result_type'], TagStyle> = {
  // 安打系 → 赤（neg トークン）
  hit:            { label: '単打',    bg: 'bg-neg/20',   text: 'text-neg-t' },
  double:         { label: '二塁打',  bg: 'bg-neg/20',   text: 'text-neg-t' },
  triple:         { label: '三塁打',  bg: 'bg-neg/20',   text: 'text-neg-t' },
  hr:             { label: 'HR',      bg: 'bg-neg/30',   text: 'text-neg-t' },
  // 四死球 → 青（theme トークン）
  walk:           { label: '四球',    bg: 'bg-theme/15', text: 'text-theme' },
  hbp:            { label: '死球',    bg: 'bg-theme/15', text: 'text-theme' },
  // アウト系 → グレー（sub2 トークン）
  strikeout:      { label: '三振',    bg: 'bg-lv2',      text: 'text-sub2' },
  groundout:      { label: 'ゴロ',    bg: 'bg-lv2',      text: 'text-sub2' },
  flyout:         { label: 'フライ',  bg: 'bg-lv2',      text: 'text-sub2' },
  infield_flyout: { label: '内飛',    bg: 'bg-lv2',      text: 'text-sub2' },
  liner_out:      { label: 'ライナー', bg: 'bg-lv2',     text: 'text-sub2' },
  sac_bunt:       { label: '犠打',    bg: 'bg-lv2',      text: 'text-sub2' },
  sac_fly:        { label: '犠飛',    bg: 'bg-lv2',      text: 'text-sub2' },
  error:          { label: 'エラー',  bg: 'bg-lv2',      text: 'text-sub2' },
  fc:             { label: '野選',    bg: 'bg-lv2',      text: 'text-sub2' },
}
