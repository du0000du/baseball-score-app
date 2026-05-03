import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP } from '@/lib/stats'
import type { AtBat, Game, User, PitchingStat } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function ScoreDisplay({ game }: { game: Game }) {
  const marker =
    game.result === 'win'  ? <span className="text-green-400">○</span> :
    game.result === 'loss' ? <span className="text-night-500">●</span> :
                             <span className="text-yellow-400">△</span>
  return (
    <span className="flex items-center gap-1 text-base font-bold leading-none shrink-0">
      {marker}
      <span className="text-white">
        {game.score_us}<span className="text-night-400 font-normal mx-0.5">-</span>{game.score_them}
      </span>
    </span>
  )
}

interface GameWithAtBats extends Game { at_bats: AtBat[] }

const CARD = 'bg-night-800 rounded-xl shadow-sm border border-night-600'
const SECTION_TITLE = 'text-xs font-semibold text-night-300 uppercase tracking-wide'
const SUB_LABEL = 'text-xs text-night-400 mt-1'

function HighlightStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center py-5 px-2 bg-night-750">
      <span className="text-xs text-night-300 mb-1.5 tracking-wide">{label}</span>
      <span className="text-3xl font-bold text-white">{value}</span>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const currentYear = new Date().getFullYear()

  const { data: profile } = await supabase.from('users').select('team_name, name').eq('id', user!.id).single()
  const typedProfile = profile as Pick<User, 'team_name' | 'name'> | null

  const { data: games } = await supabase
    .from('games').select('*, at_bats(*)').eq('season', currentYear).eq('user_id', user!.id).order('game_date', { ascending: false })
  const typedGames = (games ?? []) as GameWithAtBats[]
  const allAtBats = typedGames.flatMap((g) => g.at_bats)
  const stats = calcBattingStats(allAtBats)
  const recentGames = typedGames.slice(0, 5)

  const wins   = typedGames.filter((g) => g.result === 'win').length
  const losses = typedGames.filter((g) => g.result === 'loss').length
  const draws  = typedGames.filter((g) => g.result === 'draw').length
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, '') : '---'

  const { data: pitchingData } = await supabase
    .from('pitching_stats').select('*, games!inner(season, user_id)').eq('games.season', currentYear).eq('games.user_id', user!.id)
  const pitchingStats = (pitchingData ?? []) as PitchingStat[]
  const pStats = calcPitchingStats(pitchingStats)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-crimson-400">{currentYear}年 シーズン</h1>
          {typedProfile?.team_name && (
            <p className="text-sm text-night-400 mt-0.5">{typedProfile.team_name}</p>
          )}
        </div>
        <Link href="/games/new" className="btn bg-crimson-500 hover:bg-crimson-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          ＋ 試合を登録
        </Link>
      </div>

      {/* デスクトップ: 2カラム */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-6 lg:space-y-0">

        {/* 左カラム */}
        <div className="lg:col-span-2 space-y-6">

          {/* チーム戦績 */}
          {typedGames.length > 0 && (
            <div className={`${CARD} p-5`}>
              <h2 className={`${SECTION_TITLE} mb-3`}>チーム戦績</h2>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div>
                  <div className="text-2xl font-bold text-white">{typedGames.length}</div>
                  <div className={SUB_LABEL}>試合</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{wins}</div>
                  <div className={SUB_LABEL}>勝</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{losses}</div>
                  <div className={SUB_LABEL}>負</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{draws}</div>
                  <div className={SUB_LABEL}>分</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">{winRate}</div>
                  <div className={SUB_LABEL}>勝率</div>
                </div>
              </div>
            </div>
          )}

          {/* シーズン打撃成績 */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 py-3.5 border-b border-night-700">
              <h2 className={SECTION_TITLE}>シーズン打撃成績</h2>
            </div>
            {allAtBats.length === 0 ? (
              <p className="text-night-400 text-center py-8">まだ打席記録がありません</p>
            ) : (
              <>
                {/* 主要KPI */}
                <div className="grid grid-cols-4 divide-x divide-night-700 border-b border-night-700">
                  <HighlightStat label="打率"  value={fmtAvg(stats.avg)} />
                  <HighlightStat label="出塁率" value={fmtAvg(stats.obp)} />
                  <HighlightStat label="長打率" value={fmtAvg(stats.slg)} />
                  <HighlightStat label="OPS"   value={fmtDec(stats.ops, 3).replace(/^0/, '')} />
                </div>
                {/* 詳細数値 */}
                <div className="grid grid-cols-6 gap-0 divide-x divide-night-700 border-t border-night-700">
                  {[
                    { label: '試合',   value: typedGames.length },
                    { label: '打席',   value: stats.pa },
                    { label: '安打',   value: stats.hits },
                    { label: '本塁打', value: stats.hrs },
                    { label: '打点',   value: stats.rbi },
                    { label: '盗塁',   value: stats.sb },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center py-3">
                      <div className="text-base font-semibold text-white">{value}</div>
                      <div className="text-xs text-night-400">{label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 投手成績 */}
          {pitchingStats.length > 0 && (
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-night-700">
                <h2 className={SECTION_TITLE}>シーズン投手成績</h2>
              </div>
              <div className="grid grid-cols-4 divide-x divide-night-700 border-b border-night-700">
                <HighlightStat label="防御率" value={fmtERA(pStats.era)} />
                <HighlightStat label="WHIP"   value={fmtDec(pStats.whip, 2)} />
                <HighlightStat label="奪三振" value={pStats.strikeouts} />
                <HighlightStat label="投球回" value={formatIP(pStats.innings_pitched)} />
              </div>
              <div className="grid grid-cols-5 gap-0 divide-x divide-night-700">
                {[
                  { label: '登板', value: pStats.games,  cls: 'text-white' },
                  { label: '勝',   value: pStats.wins,   cls: 'text-green-400' },
                  { label: '敗',   value: pStats.losses, cls: 'text-red-400' },
                  { label: 'S',    value: pStats.saves,  cls: 'text-white' },
                  { label: 'H',    value: pStats.holds,  cls: 'text-white' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="text-center py-3">
                    <div className={`text-base font-semibold ${cls}`}>{value}</div>
                    <div className="text-xs text-night-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右カラム: 直近試合 */}
        <div className="lg:col-span-1">
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-night-700">
              <h2 className={SECTION_TITLE}>直近の試合</h2>
              <Link href="/games" className="text-xs text-crimson-400 hover:text-crimson-300">全て →</Link>
            </div>
            {recentGames.length === 0 ? (
              <p className="text-night-400 text-center py-8 text-sm">試合が登録されていません</p>
            ) : (
              <div className="divide-y divide-night-700">
                {recentGames.map((game) => {
                  const gameStats = calcBattingStats(game.at_bats)
                  return (
                    <div key={game.id} className="px-4 py-3 flex items-center justify-between hover:bg-night-750 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <ScoreDisplay game={game} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">vs {game.opponent}</div>
                          <div className="text-xs text-night-400 mt-0.5">{formatDate(game.game_date)}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                        {game.at_bats.length > 0 ? (
                          <span className="text-sm font-semibold text-white">
                            {gameStats.hits}/{gameStats.ab}
                            {gameStats.hrs > 0 && <span className="text-crimson-400 ml-1">{gameStats.hrs}HR</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-night-600">記録なし</span>
                        )}
                        <Link href={`/games/${game.id}/at-bats`} className="btn text-crimson-400 hover:text-crimson-300 text-xs">
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
