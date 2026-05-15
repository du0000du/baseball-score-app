'use client'

import { memo, useMemo } from 'react'
import type { AtBat, Game, Direction, OutfieldDirection, InfieldPosition, ResultType } from '@/lib/supabase/types'
import { isInfieldPosition } from '@/lib/supabase/types'

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────
interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

interface Props {
  games: GameWithAtBats[]
}

// ────────────────────────────────────────────────
// 短縮ラベル生成（「左安」「三ゴ」「右中二」etc.）
// ────────────────────────────────────────────────
const OF_PREFIX: Record<OutfieldDirection, string> = {
  left: '左', left_center: '左中', center: '中', right_center: '右中', right: '右',
}
const IF_PREFIX: Record<InfieldPosition, string> = {
  pitcher: '投', catcher: '捕', first_base: '一', second_base: '二', third_base: '三', shortstop: '遊',
}
const RESULT_SUFFIX: Partial<Record<ResultType, string>> = {
  hit: '安', double: '二', triple: '三', hr: '本',
  groundout: 'ゴ', flyout: '飛', infield_flyout: '内飛', liner_out: 'ラ',
  sac_bunt: '犠', sac_fly: '犠飛', error: '失', fc: '野選',
}
// 方向なしで単独表示する結果
const NO_DIR_LABEL: Partial<Record<ResultType, string>> = {
  strikeout: '三振', walk: '四球', hbp: '死球',
}

function getShortLabel(ab: AtBat): string {
  if (NO_DIR_LABEL[ab.result_type]) return NO_DIR_LABEL[ab.result_type]!
  const dir = ab.direction as Direction | null
  const prefix = dir
    ? isInfieldPosition(dir)
      ? IF_PREFIX[dir] ?? ''
      : OF_PREFIX[dir as OutfieldDirection] ?? ''
    : ''
  const suffix = RESULT_SUFFIX[ab.result_type] ?? ab.result_type
  return prefix + suffix
}

// ────────────────────────────────────────────────
// タグ色分け（デザイントークン）
// ────────────────────────────────────────────────
const HIT_TYPES  = new Set<ResultType>(['hit', 'double', 'triple', 'hr'])
const WALK_TYPES = new Set<ResultType>(['walk', 'hbp'])

function tagClass(resultType: ResultType): string {
  if (HIT_TYPES.has(resultType))  return 'bg-neg/20 text-neg-t'
  if (WALK_TYPES.has(resultType)) return 'bg-theme/15 text-theme'
  return 'bg-lv2 text-sub2'
}

// ────────────────────────────────────────────────
// 勝敗バッジ（インライン実装・疎結合）
// ────────────────────────────────────────────────
function GameResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win')  return <span className="text-[10px] px-1 py-0.5 rounded bg-pos text-pos-t font-bold leading-none">勝</span>
  if (result === 'loss') return <span className="text-[10px] px-1 py-0.5 rounded bg-neg text-neg-t font-bold leading-none">負</span>
  return <span className="text-[10px] px-1 py-0.5 rounded bg-neu text-neu-t font-bold leading-none">分</span>
}

// ────────────────────────────────────────────────
// 日付フォーマット
// ────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
function DirectionListView({ games }: Props) {
  // 年別グルーピング（降順）
  const groupedByYear = useMemo(() => {
    const map = new Map<number, GameWithAtBats[]>()
    for (const g of games) {
      const yr = g.season ?? parseInt(g.game_date.slice(0, 4))
      if (!map.has(yr)) map.set(yr, [])
      map.get(yr)!.push(g)
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
  }, [games])

  if (games.length === 0) {
    return (
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-12 text-center text-sub2 text-sm">
        試合データがありません
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {groupedByYear.map(([year, yearGames]) => {
        // 年別サマリー集計
        const totalAtBats = yearGames.reduce((s, g) => s + g.at_bats.length, 0)
        const totalHits   = yearGames.reduce((s, g) =>
          s + g.at_bats.filter(ab => HIT_TYPES.has(ab.result_type)).length, 0)
        const withDirection = yearGames.reduce((s, g) =>
          s + g.at_bats.filter(ab => ab.direction !== null && ab.direction !== undefined).length, 0)

        return (
          <div key={year}>
            {/* 年別セクションヘッダー（sticky） */}
            <div className="sticky top-10 z-20 bg-lv2 border-y border-s2 -mx-4 px-4 py-1.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-main">{year}年</span>
              <span className="text-xs text-sub2">{yearGames.length}試合</span>
              <span className="text-xs text-sub2">·</span>
              <span className="text-xs text-sub2">{totalAtBats}打席</span>
              <span className="text-xs text-sub2">·</span>
              <span className="text-xs text-neg-t font-medium">{totalHits}安打</span>
              {withDirection > 0 && (
                <>
                  <span className="text-xs text-sub2">·</span>
                  <span className="text-xs text-sub2">{withDirection}打球記録済</span>
                </>
              )}
            </div>

            {/* 試合カード一覧 */}
            <div className="space-y-2 pt-2 pb-1">
              {yearGames.map((game) => {
                const sortedAtBats = [...game.at_bats].sort((a, b) => a.at_bat_number - b.at_bat_number)
                const hasDirection = sortedAtBats.some(ab => ab.direction !== null && ab.direction !== undefined)

                return (
                  <div key={game.id} className="bg-lv1 rounded-xl border border-s2 overflow-hidden">
                    {/* 試合ヘッダー行 */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-s2">
                      <span className="text-sm font-semibold text-main">{formatDate(game.game_date)}</span>
                      <GameResultBadge result={game.result} />
                      <span className="text-sm font-medium text-sub1 truncate max-w-[120px]">
                        vs {game.opponent}
                      </span>
                      {(game.score_us !== null || game.score_them !== null) && (
                        <span className="text-xs text-sub2 shrink-0">
                          {game.score_us ?? '?'}-{game.score_them ?? '?'}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-sub2 shrink-0">
                        {sortedAtBats.length}打席
                      </span>
                    </div>

                    {/* 打球タグ行 */}
                    <div className="px-4 py-2.5">
                      {sortedAtBats.length === 0 ? (
                        <p className="text-xs text-sub2 italic">打席データなし</p>
                      ) : !hasDirection ? (
                        <p className="text-xs text-sub2 italic">打球方向未記録</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {sortedAtBats.map((ab) => (
                            <div key={ab.id} className="flex flex-col items-center gap-0.5">
                              <span className="text-[9px] text-sub2 leading-none">
                                {ab.at_bat_number}
                              </span>
                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-md leading-tight ${tagClass(ab.result_type)}`}
                              >
                                {getShortLabel(ab)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default memo(DirectionListView)
