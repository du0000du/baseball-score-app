'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function ScoreDisplay({ game }: { game: Game }) {
  const marker =
    game.result === 'win'  ? <span className="text-green-500">○</span> :
    game.result === 'loss' ? <span className="text-gray-600">●</span> :
                             <span className="text-yellow-500">△</span>
  return (
    <span className="flex items-center gap-1 text-base font-bold leading-none shrink-0">
      {marker}
      <span className="text-gray-800">
        {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
      </span>
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className="px-4 py-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-5 bg-gray-100 rounded" />
        <div className="h-5 bg-gray-100 rounded w-40" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-28 mb-3" />
      <div className="flex gap-2">
        <div className="h-7 w-16 bg-gray-100 rounded" />
        <div className="h-7 w-16 bg-gray-100 rounded" />
        <div className="h-7 w-10 bg-gray-100 rounded" />
        <div className="h-7 w-10 bg-gray-100 rounded" />
      </div>
    </div>
  )
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchGames = useCallback(async () => {
    const { data } = await supabase
      .from('games')
      .select('*')
      .order('game_date', { ascending: false })
    setGames(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await supabase.from('games').delete().eq('id', id)
    setConfirmId(null)
    setDeletingId(null)
    fetchGames()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-crimson-500">試合一覧</h1>
        <Link
          href="/games/new"
          className="btn bg-crimson-500 hover:bg-crimson-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          ＋ 試合を登録
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : games.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">⚾</div>
          <p className="text-gray-400 mb-4">試合が登録されていません</p>
          <Link
            href="/games/new"
            className="btn inline-block bg-crimson-500 hover:bg-crimson-600 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            最初の試合を登録する
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          {games.map((game) => (
            <div key={game.id} className="px-4 py-4">
              {confirmId === game.id ? (
                <div className="animate-fade-in">
                  <p className="text-sm text-red-700 font-medium mb-3">
                    この試合と全打席記録を削除しますか？
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="btn flex-1 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleDelete(game.id)}
                      disabled={deletingId === game.id}
                      className="btn flex-1 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
                    >
                      {deletingId === game.id ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 上段: スコア + 相手チーム */}
                  <div className="flex items-center gap-2 mb-1">
                    <ScoreDisplay game={game} />
                    <span className="text-base font-semibold text-gray-800 truncate">
                      vs {game.opponent}
                    </span>
                  </div>
                  {/* 中段: 日付・球場 */}
                  <p className="text-xs text-gray-400 mb-3 pl-0.5">
                    {formatDate(game.game_date)}
                    {game.stadium && <span className="ml-1.5">・ {game.stadium}</span>}
                  </p>
                  {/* 下段: アクションボタン */}
                  <div className="flex gap-2">
                    <Link
                      href={`/games/${game.id}/at-bats`}
                      className="btn flex-1 text-center py-2 text-xs font-medium bg-field-500 hover:bg-field-600 text-white rounded-lg"
                    >
                      打席入力
                    </Link>
                    <Link
                      href={`/games/${game.id}/pitching`}
                      className="btn flex-1 text-center py-2 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                    >
                      投手成績
                    </Link>
                    <Link
                      href={`/games/${game.id}/edit`}
                      className="btn flex-1 text-center py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                    >
                      編集
                    </Link>
                    <button
                      onClick={() => setConfirmId(game.id)}
                      className="btn flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      削除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
