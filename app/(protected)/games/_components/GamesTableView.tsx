'use client'

import Link from 'next/link'
import { formatIP } from '@/lib/stats'
import type { AtBat, PitchingStat } from '@/lib/supabase/types'
import { RESULT_TAG } from './gameConstants'

interface GameForTable {
  id: string
  game_date: string
  opponent: string
  result: 'win' | 'loss' | 'draw'
  score_us: number
  score_them: number
  season: number
  at_bats: AtBat[]
  pitching_stats: PitchingStat[]
}

interface Props {
  games: GameForTable[]
}

// 試合日を "M/D" 形式に変換（年は省略）
function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

// 打順順にソートした at_bats を返す
function sortedAtBats(atBats: AtBat[]): AtBat[] {
  return [...atBats].sort((a, b) => a.at_bat_number - b.at_bat_number)
}

// 投手サマリ（pitching_stats[0] が存在する場合のみ）
function pitchingSummary(ps: PitchingStat | undefined): string | null {
  if (!ps) return null
  return `⚾ ${formatIP(ps.innings_pitched)}回 ${ps.strikeouts}K ${ps.earned_runs}自責`
}

export default function GamesTableView({ games }: Props) {
  // season でグルーピング（降順）
  const grouped = new Map<number, GameForTable[]>()
  for (const g of games) {
    const yr = g.season ?? parseInt(g.game_date.slice(0, 4))
    if (!grouped.has(yr)) grouped.set(yr, [])
    grouped.get(yr)!.push(g)
  }
  const years = Array.from(grouped.keys()).sort((a, b) => b - a)

  if (games.length === 0) {
    return (
      <div className="bg-lv1 rounded-xl border border-s2 p-12 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <p className="text-sub2">条件に一致する試合がありません</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {years.map(yr => (
        <div key={yr} className="bg-lv1 rounded-xl border border-s2 overflow-hidden">
          {/* 年ヘッダー（sticky） */}
          <div className="sticky top-0 z-10 bg-lv2 border-b border-s2 px-4 py-1.5 flex items-center gap-2">
            <span className="text-xs font-semibold text-sub1 tracking-wide">{yr}年</span>
            <span className="text-xs text-sub2">{grouped.get(yr)!.length}試合</span>
          </div>

          {/* 試合行 */}
          <div className="divide-y divide-s2">
            {grouped.get(yr)!.map(game => {
              const resultMark =
                game.result === 'win'  ? <span className="text-pos-t font-bold">○</span> :
                game.result === 'loss' ? <span className="text-sub2 font-bold">●</span> :
                                        <span className="text-neu-t font-bold">△</span>

              const atBatTags = sortedAtBats(game.at_bats ?? [])
              const pitch = pitchingSummary(game.pitching_stats?.[0])
              const hasAtBats = atBatTags.length > 0
              const hasLine2 = hasAtBats || pitch

              return (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="block px-4 py-3 hover:bg-lv2 transition-colors active:bg-lv2"
                >
                  {/* 行1: 日付・勝敗・スコア・対戦相手・矢印 */}
                  <div className="flex items-center gap-2 min-w-0">
                    {/* 日付 */}
                    <span className="text-sm text-sub2 tabular-nums shrink-0 w-10">
                      {formatShortDate(game.game_date)}
                    </span>
                    {/* 勝敗 */}
                    <span className="text-sm shrink-0">{resultMark}</span>
                    {/* スコア */}
                    <span className="text-sm font-bold tabular-nums shrink-0 text-main">
                      {game.score_us}<span className="text-sub2 font-normal mx-0.5">-</span>{game.score_them}
                    </span>
                    {/* 対戦相手 */}
                    <span className="text-sm font-semibold text-main truncate min-w-0 flex-1">
                      vs {game.opponent}
                    </span>
                    {/* シェブロン */}
                    <svg className="w-4 h-4 text-sub2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {/* 行2: 打席タグ + 投手サマリ */}
                  {hasLine2 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1.5 pl-12">
                      {!hasAtBats ? (
                        <span className="text-xs text-neu-t bg-neu/20 rounded px-1.5 py-0.5 font-medium">未入力</span>
                      ) : (
                        atBatTags.map(ab => {
                          const style = RESULT_TAG[ab.result_type]
                          return (
                            <span
                              key={ab.id}
                              className={`text-xs rounded px-1.5 py-0.5 font-medium ${style.bg} ${style.text}`}
                            >
                              {style.label}
                            </span>
                          )
                        })
                      )}
                      {pitch && (
                        <span className="text-xs text-sub2 ml-1">{pitch}</span>
                      )}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
