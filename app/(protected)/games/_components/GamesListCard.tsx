'use client'

import Link from 'next/link'
import { FIELDING_POSITIONS, type AtBat, type FieldingPosition, type PitchingStat } from '@/lib/supabase/types'
import { formatIP } from '@/lib/stats'
import { RESULT_TAG } from './gameConstants'

// page.tsx の GameWithPitching のうち GamesListCard が必要とする最小サブセット
interface GameForList {
  id: string
  game_date: string
  opponent: string
  result: 'win' | 'loss' | 'draw'
  score_us: number
  score_them: number
  stadium?: string | null
  notes?: string | null
  at_bats: AtBat[]
  pitching_stats: PitchingStat[]
}

interface Props {
  game: GameForList
  confirmId: string | null
  deletingId: string | null
  onConfirm: (id: string | null) => void
  onDelete: (id: string) => void
}

// ── ヘルパー関数 ──

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function memoPreview(notes: string | null | undefined): string | null {
  if (!notes) return null
  const first = notes.replace(/\r\n/g, '\n').split('\n')[0].trim()
  if (!first) return null
  return first.length > 10 ? first.slice(0, 10) + '…' : first
}

function topBattingOrder(atBats: AtBat[]): number | null {
  if (atBats.length === 0) return null
  const counts = new Map<number, number>()
  for (const a of atBats) counts.set(a.batting_order, (counts.get(a.batting_order) ?? 0) + 1)
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])
  return sorted[0][0]
}

function topFieldingPosition(atBats: AtBat[]): FieldingPosition | null {
  const counts = new Map<FieldingPosition, number>()
  for (const a of atBats) {
    if (a.fielding_position) counts.set(a.fielding_position, (counts.get(a.fielding_position) ?? 0) + 1)
  }
  if (counts.size === 0) return null
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

function pitchingSummaryStr(ps: PitchingStat | undefined): string | null {
  if (!ps) return null
  return `⚾ ${formatIP(ps.innings_pitched)}回 ${ps.strikeouts}K ${ps.earned_runs}自責`
}

function sortedAtBats(atBats: AtBat[]): AtBat[] {
  return [...atBats].sort((a, b) => a.at_bat_number - b.at_bat_number)
}

// ── コンポーネント ──

export default function GamesListCard({ game, confirmId, deletingId, onConfirm, onDelete }: Props) {
  const card = "bg-lv1 rounded-xl shadow-sm border border-s2"
  const memo     = memoPreview(game.notes)
  const order    = topBattingOrder(game.at_bats ?? [])
  const pos      = topFieldingPosition(game.at_bats ?? [])
  const posLabel = pos ? FIELDING_POSITIONS.find(p => p.value === pos)?.label ?? null : null
  const pitch    = pitchingSummaryStr(game.pitching_stats?.[0])
  const hasMetaExtras = memo || order || posLabel || pitch

  // 打席タグ（打順順）
  const atBatTags = sortedAtBats(game.at_bats ?? [])
  const hasAtBats = atBatTags.length > 0

  // 勝敗マーク
  const resultMark =
    game.result === 'win'  ? <span className="text-pos-t text-lg font-bold">○</span> :
    game.result === 'loss' ? <span className="text-sub2 text-lg font-bold">●</span> :
                             <span className="text-neu-t text-lg font-bold">△</span>

  return (
    <div className={`${card} overflow-hidden`}>
      {/* ── メイン行 → 詳細ページへ ── */}
      <Link
        href={`/games/${game.id}`}
        className="flex items-start justify-between px-4 py-3.5 hover:bg-lv2 transition-colors"
      >
        {/* 左: スコア + 試合情報 */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* スコアブロック */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {resultMark}
            <span className="text-lg font-bold tabular-nums text-main">
              {game.score_us}
              <span className="text-sub2 font-normal mx-0.5 text-base">-</span>
              {game.score_them}
            </span>
          </div>
          {/* 試合情報 */}
          <div className="min-w-0 flex-1">
            {/* 対戦相手（メイン） */}
            <div className="text-base font-semibold text-main truncate">vs {game.opponent}</div>
            {/* 日付・球場（サブ） */}
            <div className="text-xs text-sub2 mt-0.5">
              {formatDate(game.game_date)}
              {game.stadium && <span className="ml-1.5">・ {game.stadium}</span>}
            </div>
            {/* メタ情報（打順・守備・投手サマリ・メモ） */}
            {hasMetaExtras && (
              <div className="flex items-center gap-2 flex-wrap text-xs text-sub2 mt-1 min-w-0">
                {(order || posLabel) && (
                  <span className="shrink-0">
                    {order ? `${order}番` : ''}{posLabel ? ` ${posLabel}` : ''}
                  </span>
                )}
                {pitch && <span className="shrink-0">{pitch}</span>}
                {memo && (
                  <span className="truncate flex items-center gap-1 min-w-0">📝 {memo}</span>
                )}
              </div>
            )}
            {/* S-1: 打席タグ列 */}
            <div className="flex items-center gap-1 flex-wrap mt-2">
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
              {/* 投球入力済バッジ */}
              {(game.pitching_stats?.length ?? 0) > 0 && (
                <span className="text-xs text-sub2 ml-0.5" title="投球入力済">⚾</span>
              )}
            </div>
          </div>
        </div>
        {/* 右: シェブロン */}
        <svg className="w-4 h-4 text-sub2 shrink-0 mt-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* ── アクションボタン（S-3: スリム化）── */}
      {confirmId === game.id ? (
        <div className="border-t border-s2 px-4 py-2.5">
          <p className="text-xs text-red-400 font-medium mb-2">この試合と全打席記録を削除しますか？</p>
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(null)}
              className="btn flex-1 py-1.5 text-xs text-sub1 bg-lv2 hover:bg-lv2 rounded-lg font-medium"
            >
              キャンセル
            </button>
            <button
              onClick={() => onDelete(game.id)}
              disabled={deletingId === game.id}
              className="btn flex-1 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {deletingId === game.id ? '削除中...' : '削除する'}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-s2 px-3 py-2 flex gap-1.5">
          <Link
            href={`/games/${game.id}/at-bats`}
            className="btn flex-1 text-center py-1.5 text-xs font-medium bg-field-500 hover:bg-field-600 text-white rounded-lg"
          >
            打席入力
          </Link>
          <Link
            href={`/games/${game.id}/pitching`}
            className="btn flex-1 text-center py-1.5 text-xs font-medium bg-theme hover:opacity-90 text-white rounded-lg"
          >
            投球入力
          </Link>
          <Link
            href={`/games/${game.id}/edit`}
            className="btn flex-1 text-center py-1.5 text-xs font-medium bg-lv2 hover:bg-lv2 text-main rounded-lg border border-s2"
          >
            編集
          </Link>
          <button
            onClick={() => onConfirm(game.id)}
            className="btn flex-1 py-1.5 text-xs font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            削除
          </button>
        </div>
      )}
    </div>
  )
}
