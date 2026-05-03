'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtDec, fmtERA, formatIP } from '@/lib/stats'
import { RESULT_TYPE_LABELS, DIRECTION_LABELS } from '@/lib/supabase/types'
import type { AtBat, Direction, Game, ResultType, PitchingStat } from '@/lib/supabase/types'
import DirectionChart from '@/app/(protected)/_components/DirectionChart'

interface GameWithAtBats extends Game { at_bats: AtBat[] }
type Tab = 'season' | 'per-game' | 'log' | 'pitching' | 'direction'

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function ResultBadge({ result }: { result: Game['result'] }) {
  if (result === 'win')  return <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 font-bold">勝</span>
  if (result === 'loss') return <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 font-bold">負</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 font-bold">分</span>
}

// 強調KPIセル（ライト: 白bg + crimson / ダーク: night-750 + white）
function HighlightStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center py-5 px-2 bg-gray-50 dark:bg-night-750">
      <span className="text-xs text-gray-400 dark:text-night-300 mb-1.5 tracking-wide">{label}</span>
      <span className="text-3xl font-bold text-crimson-500 dark:text-white">{value}</span>
    </div>
  )
}

// 2カラム成績行（ライト: white/gray-50 / ダーク: night-800/night-750）
function StatRow({ left, right }: {
  left:  { label: string; value: string | number }
  right?: { label: string; value: string | number }
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-gray-100 dark:divide-night-700 odd:bg-white dark:odd:bg-night-800 even:bg-gray-50 dark:even:bg-night-750/60">
      <div className="flex items-center justify-between px-5 py-3.5">
        <span className="text-sm text-gray-500 dark:text-night-300">{left.label}</span>
        <span className="text-xl font-bold text-crimson-700 dark:text-white">{left.value}</span>
      </div>
      {right ? (
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-sm text-gray-500 dark:text-night-300">{right.label}</span>
          <span className="text-xl font-bold text-crimson-700 dark:text-white">{right.value}</span>
        </div>
      ) : <div />}
    </div>
  )
}

const TAB_LIST: { key: Tab; label: string }[] = [
  { key: 'season',    label: '累計-打撃成績' },
  { key: 'per-game',  label: '試合別-打撃成績' },
  { key: 'log',       label: '打席別-打撃成績' },
  { key: 'pitching',  label: '投手成績' },
  { key: 'direction', label: 'op-打球方向' },
]

const CARD = 'bg-white dark:bg-night-800 rounded-xl shadow-sm border border-gray-100 dark:border-night-600 overflow-hidden'
const TH   = 'bg-gray-50 dark:bg-night-750 text-gray-500 dark:text-night-300 text-xs font-medium'
const SEC  = 'text-xs font-semibold text-gray-500 dark:text-night-300 uppercase tracking-wide'
const TD   = 'text-gray-800 dark:text-white'
const TD2  = 'text-gray-500 dark:text-night-300'

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
    const load = async () => {
      setLoading(true)
      const { data } = await supabase.from('games').select('*, at_bats(*)').eq('season', season).order('game_date', { ascending: false })
      setGames((data ?? []) as GameWithAtBats[])
      const { data: ps } = await supabase.from('pitching_stats').select('*, games!inner(season)').eq('games.season', season)
      setPitchingStats((ps ?? []) as PitchingStat[])
      setLoading(false)
    }
    load()
  }, [supabase, season])

  const handleTabChange = (newTab: Tab) => {
    if (newTab === tab) return
    setTabVisible(false)
    setTab(newTab)
    requestAnimationFrame(() => requestAnimationFrame(() => setTabVisible(true)))
  }

  const allAtBats = games.flatMap((g) => g.at_bats)
  const stats  = calcBattingStats(allAtBats)
  const pStats = calcPitchingStats(pitchingStats)
  const wins   = games.filter((g) => g.result === 'win').length
  const losses = games.filter((g) => g.result === 'loss').length
  const draws  = games.filter((g) => g.result === 'draw').length
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)).toFixed(3).replace(/^0/, '') : '---'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-crimson-500 dark:text-crimson-400">成績</h1>
        <select
          value={season}
          onChange={(e) => setSeason(parseInt(e.target.value))}
          className="border border-gray-200 dark:border-night-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-night-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-crimson-500 dark:focus:ring-crimson-400 transition-shadow duration-150"
        >
          {years.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200 dark:border-night-600">
        <div className="flex overflow-x-auto">
          {TAB_LIST.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px outline-none transition-colors duration-150 ${
                tab === key
                  ? 'text-crimson-500 dark:text-crimson-400 border-crimson-500 dark:border-crimson-400'
                  : 'text-gray-500 dark:text-night-400 hover:text-gray-700 dark:hover:text-night-200 border-transparent'
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
            <div key={i} className="bg-white dark:bg-night-800 rounded-xl border border-gray-100 dark:border-night-600 p-6 animate-pulse">
              <div className="h-4 bg-gray-100 dark:bg-night-700 rounded w-1/4 mb-4" />
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(j => <div key={j} className="h-10 bg-gray-100 dark:bg-night-700 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 min-h-[520px]" style={{ opacity: tabVisible ? 1 : 0, transition: tabVisible ? 'opacity 0.14s ease-out' : 'none' }}>

          {/* 累計-打撃成績 */}
          {tab === 'season' && (
            <div className="space-y-4">
              {games.length > 0 && (
                <div className={`${CARD} p-5`}>
                  <h2 className={`${SEC} mb-3`}>チーム戦績</h2>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div><div className="text-xl font-bold text-crimson-500 dark:text-white">{games.length}</div><div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">試合</div></div>
                    <div><div className="text-xl font-bold text-green-600 dark:text-green-400">{wins}</div><div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">勝</div></div>
                    <div><div className="text-xl font-bold text-red-500 dark:text-red-400">{losses}</div><div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">負</div></div>
                    <div><div className="text-xl font-bold text-yellow-500 dark:text-yellow-400">{draws}</div><div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">分</div></div>
                    <div><div className="text-xl font-bold text-crimson-500 dark:text-white">{winRate}</div><div className="text-xs text-gray-400 dark:text-night-400 mt-0.5">勝率</div></div>
                  </div>
                </div>
              )}

              <div className={CARD}>
                <div className="px-5 py-3.5 border-b border-gray-100 dark:border-night-700">
                  <h2 className={SEC}>打撃成績</h2>
                </div>
                {allAtBats.length === 0 ? (
                  <p className="text-gray-400 dark:text-night-400 text-center py-10">まだ打席記録がありません</p>
                ) : (
                  <>
                    <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-night-700 border-b border-gray-100 dark:border-night-700">
                      <HighlightStat label="打率"  value={fmtAvg(stats.avg)} />
                      <HighlightStat label="出塁率" value={fmtAvg(stats.obp)} />
                      <HighlightStat label="長打率" value={fmtAvg(stats.slg)} />
                      <HighlightStat label="OPS"   value={fmtDec(stats.ops, 3).replace(/^0/, '')} />
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-night-700">
                      <StatRow left={{ label: '打席',   value: stats.pa }}          right={{ label: '打数',   value: stats.ab }} />
                      <StatRow left={{ label: '安打',   value: stats.hits }}         right={{ label: '本塁打', value: stats.hrs }} />
                      <StatRow left={{ label: '二塁打', value: stats.doubles }}      right={{ label: '三塁打', value: stats.triples }} />
                      <StatRow left={{ label: '打点',   value: stats.rbi }}          right={{ label: '得点',   value: stats.runs }} />
                      <StatRow left={{ label: '盗塁',   value: stats.sb }}           right={{ label: '盗塁死', value: stats.cs }} />
                      <StatRow left={{ label: '三振',   value: stats.strikeouts }}   right={{ label: '四球',   value: stats.walks }} />
                      <StatRow left={{ label: '死球',   value: stats.hbp }}          right={{ label: '犠打',   value: stats.sac_bunt }} />
                      <StatRow left={{ label: '犠飛',   value: stats.sac_fly }}      right={{ label: 'RC27',   value: fmtDec(stats.rc27, 2) }} />
                      <StatRow left={{ label: 'IsoD',  value: fmtAvg(stats.isod) }} right={{ label: 'IsoP',   value: fmtAvg(stats.isop) }} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 試合別-打撃成績 */}
          {tab === 'per-game' && (
            <div className={CARD}>
              {games.length === 0 ? (
                <div className="p-12 text-center text-gray-400 dark:text-night-400">試合データがありません</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={TH}>
                        <th className="text-left px-4 py-3 font-medium">日付</th>
                        <th className="text-left px-4 py-3 font-medium">相手</th>
                        <th className="px-3 py-3 font-medium">勝敗</th>
                        <th className="px-3 py-3 font-medium">打席</th>
                        <th className="px-3 py-3 font-medium">打数</th>
                        <th className="px-3 py-3 font-medium">安打</th>
                        <th className="px-3 py-3 font-medium">打率</th>
                        <th className="px-3 py-3 font-medium">打点</th>
                        <th className="px-3 py-3 font-medium">三振</th>
                        <th className="px-3 py-3 font-medium">四球</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-night-700">
                      {games.map((game) => {
                        const gs = calcBattingStats(game.at_bats)
                        return (
                          <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-night-750 transition-colors duration-100">
                            <td className={`px-4 py-3 ${TD2}`}>{formatDate(game.game_date)}</td>
                            <td className={`px-4 py-3 font-medium ${TD}`}>{game.opponent}</td>
                            <td className="px-3 py-3 text-center"><ResultBadge result={game.result} /></td>
                            <td className={`px-3 py-3 text-center ${TD}`}>{gs.pa}</td>
                            <td className={`px-3 py-3 text-center ${TD2}`}>{gs.ab}</td>
                            <td className={`px-3 py-3 text-center ${TD}`}>{gs.hits}</td>
                            <td className="px-3 py-3 text-center font-bold text-crimson-600 dark:text-crimson-400 text-base">{fmtAvg(gs.avg)}</td>
                            <td className={`px-3 py-3 text-center ${TD2}`}>{gs.rbi}</td>
                            <td className={`px-3 py-3 text-center ${TD2}`}>{gs.strikeouts}</td>
                            <td className={`px-3 py-3 text-center ${TD2}`}>{gs.walks}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 打席別-打撃成績 */}
          {tab === 'log' && (
            <div className={CARD}>
              {allAtBats.length === 0 ? (
                <div className="p-12 text-center text-gray-400 dark:text-night-400">打席データがありません</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={TH}>
                        <th className="text-left px-4 py-3 font-medium">日付</th>
                        <th className="text-left px-4 py-3 font-medium">相手</th>
                        <th className="px-3 py-3 font-medium">打席</th>
                        <th className="px-3 py-3 font-medium">打順</th>
                        <th className="text-left px-3 py-3 font-medium">結果</th>
                        <th className="text-left px-3 py-3 font-medium">方向</th>
                        <th className="px-3 py-3 font-medium">打点</th>
                        <th className="px-3 py-3 font-medium">得点</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-night-700">
                      {games.flatMap((game) =>
                        game.at_bats.map((ab) => (
                          <tr key={ab.id} className="hover:bg-gray-50 dark:hover:bg-night-750 transition-colors duration-100">
                            <td className={`px-4 py-2.5 whitespace-nowrap ${TD2}`}>{formatDate(game.game_date)}</td>
                            <td className={`px-4 py-2.5 whitespace-nowrap ${TD}`}>{game.opponent}</td>
                            <td className={`px-3 py-2.5 text-center ${TD2}`}>#{ab.at_bat_number}</td>
                            <td className={`px-3 py-2.5 text-center ${TD2}`}>{ab.batting_order}番</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                ['hit','double','triple','hr'].includes(ab.result_type)
                                  ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400'
                                  : ab.result_type === 'strikeout'
                                  ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                                  : ['walk','hbp'].includes(ab.result_type)
                                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-night-700 text-gray-600 dark:text-night-300'
                              }`}>
                                {RESULT_TYPE_LABELS[ab.result_type as ResultType] ?? ab.result_type}
                              </span>
                            </td>
                            <td className={`px-3 py-2.5 text-xs ${TD2}`}>
                              {ab.direction ? DIRECTION_LABELS[ab.direction as Direction] : '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {(() => {
                                const cnt = ab.rbi_count ?? (ab.is_rbi ? 1 : 0)
                                return cnt > 0
                                  ? <span className="text-orange-500 dark:text-orange-400 font-bold">{cnt}</span>
                                  : <span className="text-gray-200 dark:text-night-600">-</span>
                              })()}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {ab.is_run
                                ? <span className="text-blue-500 dark:text-blue-400 font-bold">●</span>
                                : <span className="text-gray-200 dark:text-night-600">-</span>}
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

          {/* 投手成績 */}
          {tab === 'pitching' && (
            <div className="space-y-4">
              {pitchingStats.length === 0 ? (
                <div className={`${CARD} p-12 text-center text-gray-400 dark:text-night-400`}>投手成績が登録されていません</div>
              ) : (
                <>
                  <div className={CARD}>
                    <div className="px-5 py-3.5 border-b border-gray-100 dark:border-night-700">
                      <h2 className={SEC}>シーズン投手成績</h2>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-night-700 border-b border-gray-100 dark:border-night-700">
                      <HighlightStat label="防御率" value={fmtERA(pStats.era)} />
                      <HighlightStat label="WHIP"   value={fmtDec(pStats.whip, 2)} />
                      <HighlightStat label="K/9"    value={fmtDec(pStats.k9, 1)} />
                      <HighlightStat label="K/BB"   value={fmtDec(pStats.kbb, 2)} />
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-night-700">
                      <StatRow left={{ label: '登板',     value: pStats.games }}              right={{ label: '投球回',   value: formatIP(pStats.innings_pitched) }} />
                      <StatRow left={{ label: '勝',       value: pStats.wins }}               right={{ label: '敗',       value: pStats.losses }} />
                      <StatRow left={{ label: 'セーブ',   value: pStats.saves }}              right={{ label: 'ホールド', value: pStats.holds }} />
                      <StatRow left={{ label: '完投',     value: pStats.complete_games }}     right={{ label: '被安打',   value: pStats.hits_allowed }} />
                      <StatRow left={{ label: '被本塁打', value: pStats.home_runs_allowed }}  right={{ label: '奪三振',   value: pStats.strikeouts }} />
                      <StatRow left={{ label: '与四球',   value: pStats.walks }}              right={{ label: '与死球',   value: pStats.hit_batsmen }} />
                      <StatRow left={{ label: '失点',     value: pStats.runs_allowed }}       right={{ label: '自責点',   value: pStats.earned_runs }} />
                      <StatRow left={{ label: 'FIP',     value: fmtDec(pStats.fip, 2) }}     right={pStats.pitch_count !== null ? { label: '総投球数', value: pStats.pitch_count } : undefined} />
                    </div>
                  </div>

                  <div className={CARD}>
                    <div className="px-5 py-3.5 border-b border-gray-100 dark:border-night-700">
                      <h2 className={SEC}>試合別投手成績</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={TH}>
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
                            const rLabel: Record<string, string> = { win: '勝', loss: '敗', save: 'S', hold: 'H', none: '-' }
                            const rColor: Record<string, string> = {
                              win:  'text-green-600 dark:text-green-400 font-bold',
                              loss: 'text-red-500 dark:text-red-400 font-bold',
                              save: 'text-blue-600 dark:text-blue-400 font-bold',
                              hold: 'text-purple-600 dark:text-purple-400 font-bold',
                              none: 'text-gray-400 dark:text-night-400',
                            }
                            return (
                              <tr key={game.id} className="hover:bg-gray-50 dark:hover:bg-night-750 transition-colors duration-100">
                                <td className={`px-4 py-3 ${TD2}`}>{formatDate(game.game_date)}</td>
                                <td className={`px-4 py-3 font-medium ${TD}`}>{game.opponent}</td>
                                <td className={`px-3 py-3 text-center ${rColor[ps.result]}`}>{rLabel[ps.result]}</td>
                                <td className={`px-3 py-3 text-center ${TD}`}>{formatIP(ps.innings_pitched)}</td>
                                <td className={`px-3 py-3 text-center ${TD2}`}>{ps.hits_allowed}</td>
                                <td className={`px-3 py-3 text-center ${TD}`}>{ps.strikeouts}</td>
                                <td className={`px-3 py-3 text-center ${TD2}`}>{ps.walks}</td>
                                <td className={`px-3 py-3 text-center ${TD2}`}>{ps.runs_allowed}</td>
                                <td className={`px-3 py-3 text-center ${TD2}`}>{ps.earned_runs}</td>
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

          {/* op-打球方向 */}
          {tab === 'direction' && (
            allAtBats.length === 0 ? (
              <div className={`${CARD} p-12 text-center text-gray-400 dark:text-night-400`}>打席データがありません</div>
            ) : (
              <DirectionChart atBats={allAtBats} />
            )
          )}

        </div>
      )}
    </div>
  )
}
