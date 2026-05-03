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
        <span className="text-gray-800 dark:text-gray-100">
          {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
        </span>
      </span>
    )
  }
  if (game.result === 'loss') {
    return (
      <span className="flex items-center gap-1 text-base font-bold leading-none">
        <span className="text-gray-500">●</span>
        <span className="text-gray-800 dark:text-gray-100">
          {game.score_us}<span className="text-gray-400 font-normal mx-0.5">-</span>{game.score_them}
        </span>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-base font-bold leading-none">
      <span className="text-yellow-500">△</span>
      <span className="text-gray-800 dark:text-gray-100">
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-crimson-500">
            {currentYear}年 シーズン
          </h1>
          {typedProfile?.team_name && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{typedProfile.team_name}</p>
          )}
        </div>
        <Link
          href="/games/new"
          className="btn bg-crimson-500 hover:bg-crimson-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          ＋ 試合を登録
        </Link>
      </div>

      {/* デスクトップ: 2カラムグリッド */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-6 lg:space-y-0">

        {/* 左カラム (col-span-2): 戦績 + 打撃成績 + 投手成績 */}
        <div className="lg:col-span-2 space-y-6">

          {/* チーム戦績 */}
          {typedGames.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                チーム戦績
              </h2>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                <div>
                  <div className="text-xl font-bold text-crimson-500">{typedGames.length}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">試合</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">{wins}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">勝</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-500">{losses}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">負</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-yellow-500">{draws}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">分</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-crimson-500">{winRate}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">勝率</div>
                </div>
              </div>
            </div>
          )}

          {/* シーズン打撃成績 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
              シーズン打撃成績
            </h2>
            {allAtBats.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-center py-4">まだ打席記録がありません</p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <div className="text-center min-w-0">
                    <div className="text-2xl font-bold text-crimson-500 truncate">{fmtAvg(stats.avg)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">打率</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-2xl font-bold text-crimson-500 truncate">{fmtAvg(stats.obp)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">出塁率</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-2xl font-bold text-crimson-500 truncate">{fmtAvg(stats.slg)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">長打率</div>
                  </div>
                  <div className="text-center min-w-0">
                    <div className="text-2xl font-bold text-crimson-500 truncate">{fmtDec(stats.ops, 3).replace(/^0/, '')}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">OPS</div>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2 pt-4 border-t border-gray-100 dark:border-gray-700 text-center text-sm">
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{typedGames.length}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">試合</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{stats.pa}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">打席</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{stats.hits}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">安打</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{stats.hrs}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">本塁打</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{stats.rbi}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">打点</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 dark:text-gray-200">{stats.sb}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">盗塁</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 投手成績サマリー */}
          {pitchingStats.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                シーズン投手成績
              </h2>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="text-center min-w-0">
                  <div className="text-2xl font-bold text-crimson-500 truncate">{fmtERA(pStats.era)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">防御率</div>
                </div>
                <div className="text-center min-w-0">
                  <div className="text-2xl font-bold text-crimson-500 truncate">{fmtDec(pStats.whip, 2)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">WHIP</div>
                </div>
                <div className="text-center min-w-0">
                  <div className="text-2xl font-bold text-crimson-500 truncate">{pStats.strikeouts}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">奪三振</div>
                </div>
                <div className="text-center min-w-0">
                  <div className="text-2xl font-bold text-crimson-500 truncate">{formatIP(pStats.innings_pitched)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">投球回</div>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2 pt-4 border-t border-gray-100 dark:border-gray-700 text-center text-sm">
                <div>
                  <div className="font-semibold text-gray-700 dark:text-gray-200">{pStats.games}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">登板</div>
                </div>
                <div>
                  <div className="font-semibold text-green-600">{pStats.wins}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">勝</div>
                </div>
                <div>
                  <div className="font-semibold text-red-500">{pStats.losses}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">敗</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 dark:text-gray-200">{pStats.saves}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">S</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-700 dark:text-gray-200">{pStats.holds}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">H</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右カラム (col-span-1): 直近の試合 */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                直近の試合
              </h2>
              <Link href="/games" className="text-sm text-crimson-500 hover:underline">
                全て →
              </Link>
            </div>
            {recentGames.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-center py-4">試合が登録されていません</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {recentGames.map((game) => {
                  const gameStats = calcBattingStats(game.at_bats)
                  return (
                    <div key={game.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ScoreDisplay game={game} />
                        <div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">vs {game.opponent}</span>
                          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(game.game_date)}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-sm text-gray-500">
                        {game.at_bats.length > 0 ? (
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            {gameStats.hits}/{gameStats.ab}
                            {gameStats.hrs > 0 && (
                              <span className="text-red-500 ml-1">{gameStats.hrs}HR</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">記録なし</span>
                        )}
                        <Link
                          href={`/games/${game.id}/at-bats`}
                          className="btn text-crimson-500 hover:underline text-xs"
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
      </div>
    </div>
  )
}
