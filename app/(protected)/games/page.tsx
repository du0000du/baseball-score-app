'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtERA, formatIP } from '@/lib/stats'
import type { AtBat, Game, PitchingStat } from '@/lib/supabase/types'

interface GameWithStats extends Game {
  at_bats: AtBat[]
  pitching_stats: PitchingStat[]
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function ScoreDisplay({ game }: { game: Game }) {
  const marker =
    game.result === 'win'  ? <span className="text-green-500 text-lg">○</span> :
    game.result === 'loss' ? <span className="text-sub2 text-lg">●</span> :
                             <span className="text-yellow-500 text-lg">△</span>
  return (
    <span className="flex items-center gap-1 font-bold leading-none shrink-0">
      {marker}
      <span className="text-main text-lg">
        {game.score_us}<span className="text-sub2 font-normal mx-0.5">-</span>{game.score_them}
      </span>
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className="px-4 py-4 animate-pulse">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-5 bg-lv2 rounded" />
        <div className="h-5 bg-lv2 rounded w-40" />
      </div>
      <div className="h-3 bg-lv2 rounded w-28" />
    </div>
  )
}

export default function GamesPage() {
  const [games, setGames] = useState<GameWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchGames = useCallback(async () => {
    const { data } = await supabase
      .from('games')
      .select('*, at_bats(*), pitching_stats(*)')
      .order('game_date', { ascending: false })
    setGames((data ?? []) as GameWithStats[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchGames() }, [fetchGames])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await supabase.from('games').delete().eq('id', id)
    setConfirmId(null)
    setDeletingId(null)
    if (expandedId === id) setExpandedId(null)
    fetchGames()
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
    setConfirmId(null)
  }

  const card = "bg-lv1 rounded-xl shadow-sm border border-s2"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-accent">試合一覧</h1>
        <Link href="/games/new" className="btn bg-theme hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium">
          ＋ 試合を登録
        </Link>
      </div>

      {loading ? (
        <div className={`min-h-[520px] ${card} divide-y divide-s2`}>
          {[1,2,3].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : games.length === 0 ? (
        <div className={`${card} p-12 text-center`}>
          <div className="text-5xl mb-4">⚾</div>
          <p className="text-sub2 mb-4">試合が登録されていません</p>
          <Link href="/games/new" className="btn inline-block bg-theme hover:opacity-90 text-white px-6 py-2 rounded-lg text-sm font-medium">
            最初の試合を登録する
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((game) => {
            const isExpanded = expandedId === game.id
            const batting = calcBattingStats(game.at_bats)
            const hasPitching = game.pitching_stats.length > 0
            const pitching = hasPitching ? calcPitchingStats(game.pitching_stats) : null

            return (
              <div key={game.id} className={`${card} overflow-hidden transition-all`}>
                {/* クリック可能なヘッダー行 */}
                <button
                  type="button"
                  onClick={() => toggleExpand(game.id)}
                  className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-lv2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ScoreDisplay game={game} />
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-main truncate">vs {game.opponent}</div>
                      <div className="text-xs text-sub2 mt-0.5">
                        {formatDate(game.game_date)}
                        {game.stadium && <span className="ml-1.5">・ {game.stadium}</span>}
                      </div>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-sub2 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 展開エリア */}
                {isExpanded && (
                  <div className="border-t border-s2 px-4 pb-4 pt-3 space-y-4">
                    {/* 打撃成績サマリ */}
                    {game.at_bats.length > 0 ? (
                      <div>
                        <div className="text-xs font-semibold text-sub2 uppercase tracking-wide mb-2">打撃成績</div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs bg-lv2 rounded-lg p-3">
                          <div>
                            <div className="font-bold text-sm text-accent">{fmtAvg(batting.avg)}</div>
                            <div className="text-sub2 mt-0.5">打率</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{batting.pa}</div>
                            <div className="text-sub2 mt-0.5">打席</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{batting.ab}</div>
                            <div className="text-sub2 mt-0.5">打数</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{batting.hits}</div>
                            <div className="text-sub2 mt-0.5">安打</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{batting.hrs}</div>
                            <div className="text-sub2 mt-0.5">本塁打</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{batting.rbi}</div>
                            <div className="text-sub2 mt-0.5">打点</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{batting.sb}</div>
                            <div className="text-sub2 mt-0.5">盗塁</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-sub2 text-center py-1">打席記録なし</p>
                    )}

                    {/* 投手成績サマリ */}
                    {pitching && (
                      <div>
                        <div className="text-xs font-semibold text-sub2 uppercase tracking-wide mb-2">投手成績</div>
                        <div className="grid grid-cols-4 gap-1 text-center text-xs bg-lv2 rounded-lg p-3">
                          <div>
                            <div className="font-bold text-sm text-accent">{fmtERA(pitching.era)}</div>
                            <div className="text-sub2 mt-0.5">防御率</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{formatIP(pitching.innings_pitched)}</div>
                            <div className="text-sub2 mt-0.5">投球回</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{pitching.strikeouts}</div>
                            <div className="text-sub2 mt-0.5">奪三振</div>
                          </div>
                          <div>
                            <div className="font-semibold text-main text-sm">{pitching.earned_runs}</div>
                            <div className="text-sub2 mt-0.5">自責点</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* アクションボタン */}
                    {confirmId === game.id ? (
                      <div>
                        <p className="text-xs text-red-400 font-medium mb-2">この試合と全打席記録を削除しますか？</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmId(null)} className="btn flex-1 py-2 text-xs text-sub1 bg-lv2 hover:bg-lv2 rounded-lg font-medium">
                            キャンセル
                          </button>
                          <button onClick={() => handleDelete(game.id)} disabled={deletingId === game.id} className="btn flex-1 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50">
                            {deletingId === game.id ? '削除中...' : '削除する'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Link href={`/games/${game.id}/at-bats`} className="btn flex-1 text-center py-2 text-xs font-medium bg-field-500 hover:bg-field-600 text-white rounded-lg">打席入力</Link>
                        <Link href={`/games/${game.id}/pitching`} className="btn flex-1 text-center py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg">投手成績</Link>
                        <Link href={`/games/${game.id}/edit`} className="btn flex-1 text-center py-2 text-xs font-medium bg-lv2 hover:bg-lv2 text-main rounded-lg">編集</Link>
                        <button onClick={() => setConfirmId(game.id)} className="btn flex-1 py-2 text-xs font-medium text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">削除</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
