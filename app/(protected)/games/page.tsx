'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

function ResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win')
    return <span className="inline-block w-7 text-center py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">勝</span>
  if (result === 'loss')
    return <span className="inline-block w-7 text-center py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">負</span>
  return <span className="inline-block w-7 text-center py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">分</span>
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const supabase = createClient()

  const fetchGames = async () => {
    const { data } = await supabase
      .from('games')
      .select('*')
      .order('game_date', { ascending: false })
    setGames(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchGames()
  }, [])

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
          className="bg-navy-500 hover:bg-navy-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          ＋ 試合を登録
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : games.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">⚾</div>
          <p className="text-gray-400 mb-4">試合が登録されていません</p>
          <Link
            href="/games/new"
            className="inline-block bg-navy-500 hover:bg-navy-600 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            最初の試合を登録する
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {games.map((game) => (
            <div key={game.id} className="p-4">
              {confirmId === game.id ? (
                <div className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                  <span className="text-sm text-red-700 font-medium">
                    この試合と全打席記録を削除しますか？
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleDelete(game.id)}
                      disabled={deletingId === game.id}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
                    >
                      {deletingId === game.id ? '削除中...' : '削除する'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <ResultBadge result={game.result} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">vs {game.opponent}</span>
                        <span className="text-gray-500 text-sm">
                          {game.score_us}-{game.score_them}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDate(game.game_date)}
                        {game.stadium && ` ・ ${game.stadium}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/games/${game.id}/at-bats`}
                      className="px-3 py-1.5 text-xs font-medium bg-field-500 hover:bg-field-600 text-white rounded transition-colors"
                    >
                      打席入力
                    </Link>
                    <Link
                      href={`/games/${game.id}/edit`}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      編集
                    </Link>
                    <button
                      onClick={() => setConfirmId(game.id)}
                      className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded transition-colors"
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
