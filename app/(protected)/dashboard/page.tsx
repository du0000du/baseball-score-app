import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP } from '@/lib/stats'
import type { AtBat, Game, User, PitchingStat } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function ScoreDisplay({ game }: { game: Game }) {
  if (game.result === 'win') {
    return (
      <span className="flex items-center gap-1 text-base font-bold leading-none">
        <span className="text-green-500">○</span>
        <span className="text-gray-800">
          {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
        </span>
      </span>
    )
  }
  if (game.result === 'loss') {
    return (
      <span className="flex items-center gap-1 text-base font-bold leading-none">
        <span className="text-gray-600">●</span>
        <span className="text-gray-800">
          {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
        </span>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-base font-bold leading-none">
      <span className="text-yellow-500">△</span>
      <span className="text-gray-800">
        {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
      </span>
    </span>
  )
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

  const { data: profile } = await supabase
    .from('users')
    .select('team_name, name')
    .eq('id', user!.id)
    .single()
  const typedProfile = profile as Pick<User, 'team_name' | 'name'> | null

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

  const wins = typedGames.filter((g) => g.result === 'win').length
  const losses = typedGames.filter((g) => g.result === 'loss').length
  const draws = typedGames.filter((g) => g.result === 'draw').length
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, '') : '---'

  const { data: pitchingData } = await supabase
    .from('pitching_stats')
    .select('*, games!inner(season, user_id)')
    .eq('games.season', currentYear)
    .eq('games.user_id', user!.id)
  const pitchingStats = (pitchingData ?? []) as PitchingStat[]
  const pStats = calcPitchingStats(pitchingStats)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-500">
            {currentYear}年 シーズン
          </h1>
          {typedProfile?.team_name && (
            <p className="text-sm text-gray-500 mt-0.5">{typedProfile.team_name}</p>
          )}
        </div>
        <Link
          href="/games/new"
          className="btn bg-navy-500 hover:bg-navy-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          ＋ 試合を登録
        </Link>
      </div>

      {/* チーム戦績 */}
      {typedGames.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            チーム戦績
          </h2>
          <div className="grid grid-cols-5 gap-2 text-center text-sm">
            <div>
              <div className="text-xl font-bold text-navy-500">{typedGames.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">試合</div>
            </div>
            <div>
              <div className="text-xl font-bold text-green-600">{wins}</div>
              <div className="text-xs text-gray-400 mt-0.5">勝</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-500">{losses}</div>
              <div className="text-xs text-gray-400 mt-0.5">負</div>
            </div>
            <div>
              <div className="text-xl font-bold text-yellow-500">{draws}</div>
              <div className="text-xs text-gray-400 mt-0.5">分</div>
            </div>
            <div>
              <div className="text-xl font-bold text-navy-500">{winRate}</div>
              <div className="text-xs text-gray-400 mt-0.5">勝率</div>
            </div>
          </div>
        </div>
      )}

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

      {/* 投手成績サマリー */}
      {pitchingStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            シーズン投手成績
          </h2>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center min-w-0">
              <div className="text-2xl font-bold text-navy-500 truncate">{fmtERA(pStats.era)}</div>
              <div className="text-xs text-gray-400 mt-1">防御率</div>
            </div>
            <div className="text-center min-w-0">
              <div className="text-2xl font-bold text-navy-500 truncate">{fmtDec(pStats.whip, 2)}</div>
              <div className="text-xs text-gray-400 mt-1">WHIP</div>
            </div>
            <div className="text-center min-w-0">
              <div className="text-2xl font-bold text-navy-500 truncate">{pStats.strikeouts}</div>
              <div className="text-xs text-gray-400 mt-1">奪三振</div>
            </div>
            <div className="text-center min-w-0">
              <div className="text-2xl font-bold text-navy-500 truncate">{formatIP(pStats.innings_pitched)}</div>
              <div className="text-xs text-gray-400 mt-1">投球回</div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 pt-4 border-t border-gray-100 text-center text-sm">
            <div>
              <div className="font-semibold text-gray-700">{pStats.games}</div>
              <div className="text-xs text-gray-400">登板</div>
            </div>
            <div>
              <div className="font-semibold text-green-600">{pStats.wins}</div>
              <div className="text-xs text-gray-400">勝</div>
            </div>
            <div>
              <div className="font-semibold text-red-500">{pStats.losses}</div>
              <div className="text-xs text-gray-400">敗</div>
            </div>
            <div>
              <div className="font-semibold text-gray-700">{pStats.saves}</div>
              <div className="text-xs text-gray-400">S</div>
            </div>
            <div>
              <div className="font-semibold text-gray-700">{pStats.holds}</div>
              <div className="text-xs text-gray-400">H</div>
            </div>
          </div>
        </div>
      )}

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
                    <ScoreDisplay game={game} />
                    <div>
                      <span className="text-sm font-medium text-gray-700">vs {game.opponent}</span>
                      <div className="text-xs text-gray-400 mt-0.5">{formatDate(game.game_date)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
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
                      className="btn text-navy-500 hover:underline text-xs"
                    >
                      打席入力
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
