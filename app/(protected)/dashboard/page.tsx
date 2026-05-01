import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { calcBattingStats, fmtAvg, fmtDec } from '@/lib/stats'
import type { AtBat, Game } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function ResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win')
    return <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">勝</span>
  if (result === 'loss')
    return <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">負</span>
  return <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700">分</span>
}

interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const currentYear = new Date().getFullYear()

  const { data: games } = await supabase
    .from('games')
    .select('*, at_bats(*)')
    .eq('season', currentYear)
    .eq('user_id', user!.id)
    .order('game_date', { ascending: false })

  const typedGames = (games ?? []) as GameWithAtBats[]
  const allAtBats = typedGames.flatMap((g) => g.at_bats)
  const stats = calcBattingStats(allAtBats)
  const recentGames = typedGames.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-500">
          {currentYear}年 シーズン
        </h1>
        <Link
          href="/games/new"
          className="bg-navy-500 hover:bg-navy-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          ＋ 試合を登録
        </Link>
      </div>

      {/* 成績サマリー */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          シーズン打撃成績
        </h2>
        {allAtBats.length === 0 ? (
          <p className="text-gray-400 text-center py-4">まだ打席記録がありません</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center min-w-0">
                <div className="text-2xl font-bold text-navy-500 truncate">{fmtAvg(stats.avg)}</div>
                <div className="text-xs text-gray-400 mt-1">打率</div>
              </div>
              <div className="text-center min-w-0">
                <div className="text-2xl font-bold text-navy-500 truncate">{fmtAvg(stats.obp)}</div>
                <div className="text-xs text-gray-400 mt-1">出塁率</div>
              </div>
              <div className="text-center min-w-0">
                <div className="text-2xl font-bold text-navy-500 truncate">{fmtAvg(stats.slg)}</div>
                <div className="text-xs text-gray-400 mt-1">長打率</div>
              </div>
              <div className="text-center min-w-0">
                <div className="text-2xl font-bold text-navy-500 truncate">{fmtDec(stats.ops, 3).replace(/^0/, '')}</div>
                <div className="text-xs text-gray-400 mt-1">OPS</div>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2 pt-4 border-t border-gray-100 text-center text-sm">
              <div>
                <div className="font-semibold text-gray-700">{typedGames.length}</div>
                <div className="text-xs text-gray-400">試合</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">{stats.pa}</div>
                <div className="text-xs text-gray-400">打席</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">{stats.hits}</div>
                <div className="text-xs text-gray-400">安打</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">{stats.hrs}</div>
                <div className="text-xs text-gray-400">本塁打</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">{stats.rbi}</div>
                <div className="text-xs text-gray-400">打点</div>
              </div>
              <div>
                <div className="font-semibold text-gray-700">{stats.sb}</div>
                <div className="text-xs text-gray-400">盗塁</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 直近5試合 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            直近の試合
          </h2>
          <Link href="/games" className="text-sm text-navy-500 hover:underline">
            全試合を見る →
          </Link>
        </div>
        {recentGames.length === 0 ? (
          <p className="text-gray-400 text-center py-4">試合が登録されていません</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentGames.map((game) => {
              const gameStats = calcBattingStats(game.at_bats)
              return (
                <div key={game.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ResultBadge result={game.result} />
                    <div>
                      <span className="font-medium text-gray-800">vs {game.opponent}</span>
                      <span className="text-gray-400 text-sm ml-2">
                        {game.score_us}-{game.score_them}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{formatDate(game.game_date)}</span>
                    {game.at_bats.length > 0 ? (
                      <span className="font-medium text-gray-700">
                        {gameStats.hits}/{gameStats.ab}
                        {gameStats.hrs > 0 && (
                          <span className="text-red-500 ml-1">{gameStats.hrs}HR</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">記録なし</span>
                    )}
                    <Link
                      href={`/games/${game.id}/at-bats`}
                      className="text-navy-500 hover:underline text-xs"
                    >
                      打席入力
                    </Link>
                  </div>
                </div>
              )
      