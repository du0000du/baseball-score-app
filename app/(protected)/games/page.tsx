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
  if (game.result === 'win') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-base text-green-500 leading-none">○</span>
        <span className="text-base font-bold text-gray-800 leading-none">
          {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
        </span>
      </div>
    )
  }
  if (game.result === 'loss') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-base text-gray-600 leading-none">●</span>
        <span className="text-base font-bold text-gray-800 leading-none">
          {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
        </span>
      </div>
    )
  }
  // draw
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-base text-yellow-500 leading-none">△</span>
      <span className="text-base font-bold text-gray-800 leading-none">
        {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
      </span>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="p-4 flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-3">
        <div className="space-y-1.5">
          <div className="h-4 bg-gray-100 rounded w-32" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-16 bg-gray-100 rounded" />
        <div className="h-7 w-16 bg-gray-100 rounded" />
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
        <h1 className="text-2xl font-bold text-navy-500">試合一覧</h1>
        <Link
          href="/games/new"
          className="btn bg-navy-500 hover:bg-navy-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          ＋ 試合を登録
        </Link>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {[1,2,3].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : games.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">⚾</div>
          <p className="text-gray-400 mb-4">試合が登録されていません</p>
          <Link
            href="/games/new"
            className="btn inline-block bg-navy-500 hover:bg-navy-600 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            最初の試合を登録する
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {games.map((game) => (
            <div key={game.id} className="p-4 transition-colors duration-100">
              {confirmId === game.id ? (
                <div className="flex items-center justify-between bg-red-50 rounded-lg p-3 animate-fade-in">
                  <span className="text-sm text-red-700 font-medium">
                    この試合と全打席記録を削除しますか？
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="btn px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleDelete(game.id)}
                      disabled={deletingId === game.id}
                      className="btn px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                    >
                      {deletingId === game.id ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <ScoreDisplay game={game} />
                        <span className="font-medium text-gray-700 text-sm">vs {game.opponent}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDate(game.game_date)}
                        {game.stadium && ` ・ ${game.stadium}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/games/${game.id}/at-bats`}
                      className="btn px-2.5 py-1.5 text-xs font-medium bg-field-500 hover:bg-field-600 text-white rounded"
                    >
                      打席入力
                    </Link>
                    <Link
                      href={`/games/${game.id}/pitching`}
                      className="btn px-2.5 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded"
                    >
                      投手成績
                    </Link>
                    <Link
                      href={`/games/${game.id}/edit`}
                      className="btn px-2.5 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                    >
                      編集
                    </Link>
                    <button
                      onClick={() => setConfirmId(game.id)}
                      className="btn px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
