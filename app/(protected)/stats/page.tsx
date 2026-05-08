'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP } from '@/lib/stats'
import { RESULT_TYPE_LABELS, DIRECTION_LABELS } from '@/lib/supabase/types'
import type { AtBat, Direction, Game, ResultType, PitchingStat } from '@/lib/supabase/types'
import DirectionChart from '@/app/(protected)/_components/DirectionChart'

interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

type Tab = 'season' | 'per-game' | 'log' | 'pitching' | 'direction'

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function ResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win') return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">勝</span>
  if (result === 'loss') return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">負</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-bold">分</span>
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-crimson-500 dark:text-crimson-400">{value}</div>
      <div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">{label}</div>
    </div>
  )
}

// 2カラムリスト形式の1行（左右それぞれラベル+値）
function StatRow({ left, right }: {
  left: { label: string; value: string | number }
  right?: { label: string; value: string | number }
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-gray-100 odd:bg-white even:bg-gray-50 dark:odd:bg-night-800 dark:even:bg-night-750 dark:odd:bg-gray-800 dark:even:bg-gray-750/50">
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="text-sm text-gray-500 dark:text-night-400">{left.label}</span>
        <span className="text-xl font-bold text-crimson-700 dark:text-crimson-400">{left.value}</span>
      </div>
      {right ? (
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-sm text-gray-500 dark:text-night-400">{right.label}</span>
          <span className="text-xl font-bold text-crimson-700 dark:text-crimson-400">{right.value}</span>
        </div>
      ) : (
        <div />
      )}
    </div>
  )
}

const TAB_LIST: { key: Tab; label: string }[] = [
  { key: 'season',    label: 'シーズン累計' },
  { key: 'per-game',  label: '試合別' },
  { key: 'log',       label: '打席ログ' },
  { key: 'pitching',  label: '投手成績' },
  { key: 'direction', label: '打球方向' },
]

export default function StatsPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const currentYear = new Date().getFullYear()
  const [season, setSeason] = useState(currentYear)
  const [games, setGames] = useState<GameWithAtBats[]>([])
  const [pitchingStats, setPitchingStats] = useState<PitchingStat[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('season')
  const [tabVisible, setTabVisible] = useState(true)

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('games')
        .select('*, at_bats(*)')
        .eq('season', season)
        .order('game_date', { ascending: false })
      setGames((data ?? []) as GameWithAtBats[])

      const { data: ps } = await supabase
        .from('pitching_stats')
        .select('*, games!inner(season)')
        .eq('games.season', season)
      setPitchingStats((ps ?? []) as PitchingStat[])

      setLoading(false)
    }
    fetch()
  }, [supabase, season])

  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return
    setTabVisible(false)
    setTab(newTab)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTabVisible(true))
    })
  }

  const allAtBats = games.flatMap((g) => g.at_bats)
  const stats = calcBattingStats(allAtBats)
  const pStats = calcPitchingStats(pitchingStats)

  const wins = games.filter((g) => g.result === 'win').length
  const losses = games.filter((g) => g.result === 'loss').length
  const draws = games.filter((g) => g.result === 'draw').length
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, '') : '---'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-crimson-500 dark:text-crimson-400">成績</h1>
        <select
          value={season}
          onChange={(e) => setSeason(parseInt(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-crimson-500 transition-shadow duration-150"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TAB_LIST.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px outline-none transition-colors duration-150 ${
                tab === key
                  ? 'text-crimson-500 border-crimson-500'
                  : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 min-h-[520px]">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/4 mb-4" />
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(j => <div key={j} className="h-10 bg-gray-100 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="space-y-4 min-h-[520px]"
          style={{
            opacity: tabVisible ? 1 : 0,
            transition: tabVisible ? 'opacity 0.14s ease-out' : 'none',
          }}
        >

          {/* タブ1: シーズン累計 */}
          {tab === 'season' && (
            <div className="space-y-4">
              {games.length > 0 && (
                <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 p-5">
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-night-400 uppercase tracking-wide mb-3">チーム戦績</h2>
                  <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    <div>
                      <div className="text-xl font-bold text-crimson-500 dark:text-crimson-400">{games.length}</div>
                      <div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">試合</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-600">{wins}</div>
                      <div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">勝</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-red-500">{losses}</div>
                      <div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">負</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-yellow-500">{draws}</div>
                      <div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">分</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-crimson-500 dark:text-crimson-400">{winRate}</div>
                      <div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">勝率</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-night-400 uppercase tracking-wide">打撃成績</h2>
                </div>
                {allAtBats.length === 0 ? (
                  <p className="text-gray-400 dark:text-night-400 text-center py-8">まだ打席記録がありません</p>
                ) : (
                  <>
                    {/* 主要指標ハイライト */}
                    <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                      {[
                        { label: '打率', value: fmtAvg(stats.avg) },
                        { label: '出塁率', value: fmtAvg(stats.obp) },
                        { label: '長打率', value: fmtAvg(stats.slg) },
                        { label: 'OPS', value: fmtDec(stats.ops, 3).replace(/^0/, '') },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center py-4 px-2">
                          <span className="text-xs text-gray-400 dark:text-night-400 mb-1">{label}</span>
                          <span className="text-2xl font-bold text-crimson-500 dark:text-crimson-400">{value}</span>
                        </div>
                      ))}
                    </div>
                    {/* 詳細成績 2カラムリスト */}
                    <div className="divide-y divide-gray-100 dark:divide-night-700">
                      <StatRow left={{ label: '打席', value: stats.pa }}        right={{ label: '打数', value: stats.ab }} />
                      <StatRow left={{ label: '安打', value: stats.hits }}      right={{ label: '本塁打', value: stats.hrs }} />
                      <StatRow left={{ label: '二塁打', value: stats.doubles }} right={{ label: '三塁打', value: stats.triples }} />
                      <StatRow left={{ label: '打点', value: stats.rbi }}       right={{ label: '得点', value: stats.runs }} />
                      <StatRow left={{ label: '盗塁', value: stats.sb }}        right={{ label: '盗塁死', value: stats.cs }} />
                      <StatRow left={{ label: '三振', value: stats.strikeouts }} right={{ label: '四球', value: stats.walks }} />
                      <StatRow left={{ label: '死球', value: stats.hbp }}       right={{ label: '犠打', value: stats.sac_bunt }} />
                      <StatRow left={{ label: '犠飛', value: stats.sac_fly }}   right={{ label: 'RC27', value: fmtDec(stats.rc27, 2) }} />
                      <StatRow left={{ label: 'IsoD', value: fmtAvg(stats.isod) }} right={{ label: 'IsoP', value: fmtAvg(stats.isop) }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* タブ2: 試合別 */}
          {tab === 'per-game' && (
            <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 overflow-hidden">
              {games.length === 0 ? (
                <div className="p-12 text-center text-gray-400">試合データがありません</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="text-left px-4 py-3 font-medium">日付</th>
                        <th className="text-left px-4 py-3 font-medium">相手</th>
                        <th className="px-3 py-3 font-medium">勝敗</th>
                        <th className="px-3 py-3 font-medium">打席</th>
                        <th className="px-3 py-3 font-medium">打数</th>
                        <th className="px-3 py-3 font-medium">安打</th>
                        <th className="px-3 py-3 font-medium">打率</th>
                        <th className="px-3 py-3 font-medium">打点</th>
                        <th className="px-3 py-3 font-medium">盗塁</th>
                        <th className="px-3 py-3 font-medium">三振</th>
                        <th className="px-3 py-3 font-medium">四球</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-night-700">
                      {games.map((game) => {
                        const gs = calcBattingStats(game.at_bats)
                        return (
                          <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-night-750 dark:hover:bg-gray-700/50 transition-colors duration-100">
                            <td className="px-4 py-3 text-gray-600 dark:text-night-200">{formatDate(game.game_date)}</td>
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{game.opponent}</td>
                            <td className="px-3 py-3 text-center"><ResultBadge result={game.result} /></td>
                            <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{gs.pa}</td>
                            <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{gs.ab}</td>
                            <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{gs.hits}</td>
                            <td className="px-3 py-3 text-center font-medium text-crimson-500 dark:text-crimson-400">{fmtAvg(gs.avg)}</td>
                            <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{gs.rbi}</td>
                            <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{gs.sb}</td>
                            <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{gs.strikeouts}</td>
                            <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{gs.walks}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* タブ3: 全打席ログ */}
          {tab === 'log' && (
            <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 overflow-hidden">
              {allAtBats.length === 0 ? (
                <div className="p-12 text-center text-gray-400">打席データがありません</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="text-left px-4 py-3 font-medium">日付</th>
                        <th className="text-left px-4 py-3 font-medium">相手</th>
                        <th className="px-3 py-3 font-medium">打席</th>
                        <th className="px-3 py-3 font-medium">打順</th>
                        <th className="text-left px-3 py-3 font-medium">結果</th>
                        <th className="text-left px-3 py-3 font-medium">方向</th>
                        <th className="px-3 py-3 font-medium">打点</th>
                        <th className="px-3 py-3 font-medium">盗塁</th>
                        <th className="px-3 py-3 font-medium">得点</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-night-700">
                      {games.flatMap((game) =>
                        game.at_bats.map((ab) => (
                          <tr key={ab.id} className="hover:bg-gray-50 dark:hover:bg-night-750 dark:hover:bg-gray-700/50 transition-colors duration-100">
                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(game.game_date)}</td>
                            <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{game.opponent}</td>
                            <td className="px-3 py-2.5 text-center text-gray-500">#{ab.at_bat_number}</td>
                            <td className="px-3 py-2.5 text-center text-gray-700 dark:text-night-100">{ab.batting_order}番</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                ['hit','double','triple','hr'].includes(ab.result_type)
                                  ? 'bg-green-100 text-green-700'
                                  : ab.result_type === 'strikeout'
                                  ? 'bg-red-100 text-red-700'
                                  : ['walk','hbp'].includes(ab.result_type)
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {RESULT_TYPE_LABELS[ab.result_type as ResultType] ?? ab.result_type}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">
                              {ab.direction ? DIRECTION_LABELS[ab.direction as Direction] : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {(() => {
                                const cnt = ab.rbi_count ?? (ab.is_rbi ? 1 : 0)
                                return cnt > 0
                                  ? <span className="text-orange-500 font-bold">{cnt}</span>
                                  : <span className="text-gray-200">-</span>
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {(() => {
                                const sb = ab.stolen_base_count ?? (ab.is_stolen_base ? 1 : 0)
                                return sb > 0
                                  ? <span className="text-green-500 font-bold">{sb}</span>
                                  : <span className="text-gray-200">-</span>
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {ab.is_run ? <span className="text-blue-500 font-bold">●</span> : <span className="text-gray-200">-</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* タブ4: 投手成績 */}
          {tab === 'pitching' && (
            <div className="space-y-4">
              {pitchingStats.length === 0 ? (
                <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 p-12 text-center text-gray-400">
                  投手成績が登録されていません
                </div>
              ) : (
                <>
                  <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h2 className="text-sm font-semibold text-gray-500 dark:text-night-400 uppercase tracking-wide">シーズン投手成績</h2>
                    </div>
                    {/* 主要指標ハイライト */}
                    <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                      {[
                        { label: '防御率', value: fmtERA(pStats.era) },
                        { label: 'WHIP', value: fmtDec(pStats.whip, 2) },
                        { label: 'K/9', value: fmtDec(pStats.k9, 1) },
                        { label: 'K/BB', value: fmtDec(pStats.kbb, 2) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center py-4 px-2">
                          <span className="text-xs text-gray-400 dark:text-night-400 mb-1">{label}</span>
                          <span className="text-2xl font-bold text-crimson-500 dark:text-crimson-400">{value}</span>
                        </div>
                      ))}
                    </div>
                    {/* 詳細成績 2カラムリスト */}
                    <div className="divide-y divide-gray-100 dark:divide-night-700">
                      <StatRow left={{ label: '登板', value: pStats.games }}          right={{ label: '投球回', value: formatIP(pStats.innings_pitched) }} />
                      <StatRow left={{ label: '勝', value: pStats.wins }}             right={{ label: '敗', value: pStats.losses }} />
                      <StatRow left={{ label: 'セーブ', value: pStats.saves }}        right={{ label: 'ホールド', value: pStats.holds }} />
                      <StatRow left={{ label: '完投', value: pStats.complete_games }} right={{ label: '被安打', value: pStats.hits_allowed }} />
                      <StatRow left={{ label: '被本塁打', value: pStats.home_runs_allowed }} right={{ label: '奪三振', value: pStats.strikeouts }} />
                      <StatRow left={{ label: '与四球', value: pStats.walks }}        right={{ label: '与死球', value: pStats.hit_batsmen }} />
                      <StatRow left={{ label: '失点', value: pStats.runs_allowed }}   right={{ label: '自責点', value: pStats.earned_runs }} />
                      <StatRow left={{ label: 'FIP', value: fmtDec(pStats.fip, 2) }} right={pStats.pitch_count !== null ? { label: '総投球数', value: pStats.pitch_count } : undefined} />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h2 className="text-sm font-semibold text-gray-500 dark:text-night-400 uppercase tracking-wide">試合別投手成績</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 text-xs">
                            <th className="text-left px-4 py-3 font-medium">日付</th>
                            <th className="text-left px-4 py-3 font-medium">相手</th>
                            <th className="px-3 py-3 font-medium">結果</th>
                            <th className="px-3 py-3 font-medium">投球回</th>
                            <th className="px-3 py-3 font-medium">被安</th>
                            <th className="px-3 py-3 font-medium">K</th>
                            <th className="px-3 py-3 font-medium">BB</th>
                            <th className="px-3 py-3 font-medium">失点</th>
                            <th className="px-3 py-3 font-medium">自責</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-night-700">
                          {games.map((game) => {
                            const ps = pitchingStats.find(p => p.game_id === game.id)
                            if (!ps) return null
                            const resultLabels: Record<string, string> = { win: '勝', loss: '敗', save: 'S', hold: 'H', none: '-' }
                            const resultColors: Record<string, string> = {
                              win: 'text-green-600 font-bold', loss: 'text-red-500 font-bold',
                              save: 'text-blue-600 font-bold', hold: 'text-purple-600 font-bold', none: 'text-gray-400'
                            }
                            return (
                              <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-night-750 dark:hover:bg-gray-700/50 transition-colors duration-100">
                                <td className="px-4 py-3 text-gray-600 dark:text-night-200">{formatDate(game.game_date)}</td>
                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{game.opponent}</td>
                                <td className={`px-3 py-3 text-center ${resultColors[ps.result]}`}>{resultLabels[ps.result]}</td>
                                <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{formatIP(ps.innings_pitched)}</td>
                                <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{ps.hits_allowed}</td>
                                <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{ps.strikeouts}</td>
                                <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{ps.walks}</td>
                                <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{ps.runs_allowed}</td>
                                <td className="px-3 py-3 text-center text-gray-700 dark:text-night-100">{ps.earned_runs}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* タブ5: 打球方向 */}
          {tab === 'direction' && (
            allAtBats.length === 0 ? (
              <div className="bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 p-12 text-center text-gray-400">
                打席データがありません
              </div>
            ) : (
              <DirectionChart atBats={allAtBats} />
            )
          )}

        </div>
      )}
    </div>
  )
}
