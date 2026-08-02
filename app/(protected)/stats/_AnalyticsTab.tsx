'use client'

// PERF-9: recharts（gzip 約104kB）を使うのはこの「分析」タブだけ。
// stats/page.tsx から dynamic import することで、
// 既定表示のシーズン累計タブでは recharts をダウンロードしなくて済むようにする。

import { calcBattingStats, fmtAvg, fmtDec, fmtERA } from '@/lib/stats'
import { FIELDING_POSITIONS } from '@/lib/supabase/types'
import type { AtBat, BattingStats, Game, PitchingStat } from '@/lib/supabase/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'

interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function avgColor(avg: number | null): string {
  if (avg === null) return 'text-accent'
  if (avg >= 0.300) return 'text-pos-t'
  if (avg >= 0.250) return 'text-neu-t'
  return 'text-neg-t'
}

function opsColor(ops: number | null): string {
  if (ops === null) return 'text-accent'
  if (ops >= 0.800) return 'text-pos-t'
  if (ops >= 0.700) return 'text-neu-t'
  return 'text-neg-t'
}

interface Props {
  games: GameWithAtBats[]
  stats: BattingStats
  pitchingStats: PitchingStat[]
  allAtBats: AtBat[]
  season: number | 'all'
}

export default function AnalyticsTab({ games, stats, pitchingStats, allAtBats, season }: Props) {
            const card = 'bg-lv1 rounded-xl shadow-sm border border-s2'

            // 1. 安打種別データ
            const hitTypeData = [
              { name: '単打', value: stats.hits - stats.doubles - stats.triples - stats.hrs },
              { name: '二塁打', value: stats.doubles },
              { name: '三塁打', value: stats.triples },
              { name: '本塁打', value: stats.hrs },
            ].filter(d => d.value > 0)
            const HIT_COLORS = ['var(--theme)', '#60a5fa', '#f97316', 'var(--pos_text)']

            // 2. 試合別 RBI/HR データ（古い順）
            const sortedGames = [...games].sort((a, b) => a.game_date.localeCompare(b.game_date))

            // CH-1: 打率推移データ（累積 + 単試合）
            const avgChartData = sortedGames.reduce((acc, game) => {
              const prev = acc[acc.length - 1]
              const gStats = calcBattingStats(game.at_bats)
              const cumAB = (prev?.cumAB ?? 0) + gStats.ab
              const cumHits = (prev?.cumHits ?? 0) + gStats.hits
              return [...acc, {
                date: `${parseInt(game.game_date.split('-')[1])}/${parseInt(game.game_date.split('-')[2])}`,
                cumAvg: cumAB > 0 ? cumHits / cumAB : null,
                gameAvg: gStats.ab > 0 ? gStats.hits / gStats.ab : null,
                cumAB, cumHits,
                ab: gStats.ab, hits: gStats.hits,
              }]
            }, [] as any[])

            const rbiHrData = sortedGames.map((g) => {
              const gs = calcBattingStats(g.at_bats)
              return { date: formatDate(g.game_date), rbi: gs.rbi, hr: gs.hrs }
            })

            // 3. 勝敗別打率
            const winGames = games.filter(g => g.result === 'win')
            const lossGames = games.filter(g => g.result === 'loss')
            const winStats = calcBattingStats(winGames.flatMap(g => g.at_bats))
            const lossStats = calcBattingStats(lossGames.flatMap(g => g.at_bats))

            // 4. OPS 推移データ（累積 + 単試合）
            const opsData = sortedGames.map((game, idx) => {
              const cumStats = calcBattingStats(sortedGames.slice(0, idx + 1).flatMap(g => g.at_bats))
              const gameStats = calcBattingStats(game.at_bats)
              return {
                date: formatDate(game.game_date),
                cumOps: parseFloat((cumStats.ops ?? 0).toFixed(3)),
                gameOps: parseFloat((gameStats.ops ?? 0).toFixed(3)),
              }
            })

            // 5. ERA トレンドデータ
            const sortedPitching = [...pitchingStats].sort((a, b) => {
              const ga = games.find(g => g.id === a.game_id)
              const gb = games.find(g => g.id === b.game_id)
              return (ga?.game_date ?? '').localeCompare(gb?.game_date ?? '')
            })
            const eraData = sortedPitching.reduce((acc, ps) => {
              const prev = acc[acc.length - 1]
              const totalER = (prev?.totalER ?? 0) + ps.earned_runs
              const totalIP = (prev?.totalIP ?? 0) + ps.innings_pitched
              const era = totalIP > 0 ? parseFloat(((totalER * 21) / totalIP).toFixed(2)) : 0
              const gameEra = ps.innings_pitched > 0
                ? parseFloat(((ps.earned_runs * 21) / ps.innings_pitched).toFixed(2))
                : null
              const g = games.find(gm => gm.id === ps.game_id)
              return [...acc, { date: g ? formatDate(g.game_date) : '', era, gameEra, totalER, totalIP }]
            }, [] as { date: string; era: number; gameEra: number | null; totalER: number; totalIP: number }[])

            return (
              <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">

                {/* 1. 安打種別ドーナツ */}
                {stats.hits > 0 && (
                  <div className={`${card} p-5`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">安打種別</h2>
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={hitTypeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            dataKey="value"
                          >
                            {hitTypeData.map((entry, index) => (
                              <Cell key={entry.name} fill={HIT_COLORS[index]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number, name: string) => [`${value}本`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-accent">{stats.hits}</span>
                        <span className="text-xs text-sub2">安打</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center mt-2">
                      {hitTypeData.map((entry, i) => (
                        <span key={entry.name} className="flex items-center gap-1 text-xs text-sub1">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: HIT_COLORS[i] }} />
                          {entry.name}: {entry.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CH-1: 打率推移 — 安打種別の直後・PC全幅 */}
                {sortedGames.length >= 3 && (
                  <div className={`${card} p-5 lg:col-span-2`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">打率推移</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={avgChartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <YAxis
                          tickFormatter={(v) => fmtAvg(v)}
                          tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }}
                          domain={[0, 1]}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const cum = payload.find(p => p.dataKey === 'cumAvg')
                            const game = payload.find(p => p.dataKey === 'gameAvg')
                            const gameEntry = avgChartData.find((d: any) => d.date === label)
                            return (
                              <div className="bg-lv1 border border-s2 rounded-lg px-3 py-2 text-xs shadow-sm">
                                <div className="font-semibold text-main mb-1">{label}</div>
                                {cum?.value != null && <div className="text-sub1">累積 {fmtAvg(cum.value as number)}</div>}
                                {game?.value != null && gameEntry && (
                                  <div className="text-sub2">単試合 {fmtAvg(game.value as number)}（{gameEntry.ab}打数{gameEntry.hits}安打）</div>
                                )}
                              </div>
                            )
                          }}
                        />
                        <Line type="monotone" dataKey="cumAvg" stroke="var(--theme)" strokeWidth={2}
                          dot={{ r: 3, fill: 'var(--theme)' }} connectNulls />
                        <Line type="monotone" dataKey="gameAvg" stroke="var(--sub_text_lv2)" strokeWidth={1.5}
                          strokeDasharray="4 2" dot={{ r: 2, fill: 'var(--sub_text_lv2)' }} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-sub2 text-right mt-1">実線: 累積打率　破線: 単試合打率</p>
                  </div>
                )}

                {/* CH-2: OPS 推移 — PC全幅 */}
                {sortedGames.length >= 2 && (
                  <div className={`${card} p-5 lg:col-span-2`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">OPS 推移</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={opsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <YAxis
                          domain={[0, 1.4]}
                          tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }}
                          tickFormatter={(v: number) => v.toFixed(1)}
                        />
                        <Tooltip formatter={(v: number, name: string) => [
                          fmtDec(v, 3).replace(/^0/, ''),
                          name === 'cumOps' ? '累積OPS' : '単試合OPS',
                        ]} />
                        <Line type="monotone" dataKey="cumOps" stroke="var(--theme)" strokeWidth={2}
                          dot={{ r: 3, fill: 'var(--theme)' }} name="cumOps" />
                        <Line type="monotone" dataKey="gameOps" stroke="var(--sub_text_lv1)" strokeWidth={1}
                          dot={false} strokeDasharray="4 2" name="gameOps" />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-sub2 text-right mt-1">実線: 累積OPS　破線: 単試合OPS</p>
                  </div>
                )}

                {/* 2. 試合別 RBI / HR */}
                {sortedGames.length >= 3 && (
                  <div className={`${card} p-5`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">試合別 RBI / HR</h2>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={rbiHrData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                        <Tooltip />
                        <Bar dataKey="rbi" name="打点" fill="var(--theme)" />
                        <Bar dataKey="hr" name="HR" fill="#f97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* 3. 勝敗別打率比較 */}
                <div className={`${card} p-5`}>
                  <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">勝敗別打率</h2>
                  {winGames.length === 0 && lossGames.length === 0 ? (
                    <p className="text-sub2 text-sm text-center py-4">データなし</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-lv2 rounded-lg p-4 text-center">
                        <div className="text-xs text-sub2 mb-1">勝ち（{winGames.length}試合）</div>
                        <div className="text-2xl font-bold text-pos-t">{fmtAvg(winStats.avg)}</div>
                        <div className="text-xs text-sub2 mt-1">打率</div>
                      </div>
                      <div className="bg-lv2 rounded-lg p-4 text-center">
                        <div className="text-xs text-sub2 mb-1">負け（{lossGames.length}試合）</div>
                        <div className="text-2xl font-bold text-neg-t">{fmtAvg(lossStats.avg)}</div>
                        <div className="text-xs text-sub2 mt-1">打率</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. ERA 推移（累積実線 + 単試合破線） */}
                {pitchingStats.length > 0 && (
                  <div className={`${card} p-5`}>
                    <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">防御率推移</h2>
                    {pitchingStats.length < 3 ? (
                      <p className="text-sub2 text-sm text-center py-4">登板数が増えると表示されます</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={eraData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--stroke_lv2)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                          <Tooltip
                            formatter={(v: number, name: string) => [
                              fmtERA(v),
                              name === 'era' ? '累積防御率' : '単試合防御率',
                            ]}
                          />
                          <Legend
                            formatter={(value: string) => value === 'era' ? '累積（実線）' : '単試合（破線）'}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="era"
                            stroke="var(--theme)"
                            strokeWidth={2}
                            dot={{ r: 3, fill: 'var(--theme)' }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="gameEra"
                            stroke="var(--accent)"
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                            dot={{ r: 2, fill: 'var(--accent)' }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}

                {/* 6. 打順別成績 (B-1) */}
                {(() => {
                  const orders = [1,2,3,4,5,6,7,8,9]
                  const rows = orders.map(order => {
                    const abs = allAtBats.filter(ab => ab.batting_order === order)
                    if (abs.length === 0) return null
                    const s = calcBattingStats(abs)
                    return { order, pa: s.pa, ab: s.ab, hits: s.hits, hrs: s.hrs, rbi: s.rbi, avg: s.avg }
                  }).filter(Boolean)
                  if (rows.length === 0) return null
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">打順別成績</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">打順</th>
                              <th className="px-2 py-2">打席</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                              <th className="px-2 py-2">打点</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {rows.map(row => (
                              <tr key={row!.order} className="text-center">
                                <td className="text-left py-2 font-medium text-main">{row!.order}番</td>
                                <td className="px-2 py-2 text-sub1">{row!.pa}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(row!.avg)}`}>{fmtAvg(row!.avg)}</td>
                                <td className="px-2 py-2 text-main">{row!.hits}</td>
                                <td className="px-2 py-2 text-main">{row!.hrs}</td>
                                <td className="px-2 py-2 text-main">{row!.rbi}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 7. 対戦相手別成績 (B-2 / L7-1: PA + RBI 追加 → table 形式) */}
                {(() => {
                  const opponents = [...new Set(games.map(g => g.opponent))]
                  if (opponents.length < 2) return null
                  const rows = opponents.map(opp => {
                    const oppGames = games.filter(g => g.opponent === opp)
                    const oppABs = oppGames.flatMap(g => g.at_bats)
                    const s = calcBattingStats(oppABs)
                    const oppWins = oppGames.filter(g => g.result === 'win').length
                    return { opp, games: oppGames.length, wins: oppWins, avg: s.avg, pa: s.pa, hits: s.hits, hrs: s.hrs, rbi: s.rbi }
                  }).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">対戦相手別成績</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">相手</th>
                              <th className="px-2 py-2">試合</th>
                              <th className="px-2 py-2">打席</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                              <th className="px-2 py-2">打点</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {rows.map(r => (
                              <tr key={r.opp} className="text-center">
                                <td className="text-left py-2 text-xs font-medium text-main">
                                  vs {r.opp}
                                  <span className="text-sub2 font-normal ml-1">{r.wins}勝</span>
                                </td>
                                <td className="px-2 py-2 text-sub1">{r.games}</td>
                                <td className="px-2 py-2 text-sub1">{r.pa}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(r.avg)}`}>{fmtAvg(r.avg)}</td>
                                <td className="px-2 py-2 text-main">{r.hits}</td>
                                <td className="px-2 py-2 text-main">{r.hrs > 0 ? r.hrs : '-'}</td>
                                <td className="px-2 py-2 text-main">{r.rbi}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 8. 守備位置別成績 (N-1) */}
                {(() => {
                  const posRows = FIELDING_POSITIONS.map(({ value, full }) => {
                    const posABs = allAtBats.filter(ab => ab.fielding_position === value)
                    if (posABs.length === 0) return null
                    const s = calcBattingStats(posABs)
                    return { label: full, pa: s.pa, ab: s.ab, hits: s.hits, hrs: s.hrs, avg: s.avg }
                  }).filter(Boolean)
                  if (posRows.length === 0) return null
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">守備位置別成績</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">ポジション</th>
                              <th className="px-2 py-2">打席</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {posRows.map(row => (
                              <tr key={row!.label} className="text-center">
                                <td className="text-left py-2 font-medium text-main">{row!.label}</td>
                                <td className="px-2 py-2 text-sub1">{row!.pa}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(row!.avg)}`}>{fmtAvg(row!.avg)}</td>
                                <td className="px-2 py-2 text-main">{row!.hits}</td>
                                <td className="px-2 py-2 text-main">{row!.hrs > 0 ? row!.hrs : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 9. 月別打率 (L-3) */}
                {(() => {
                  const monthMap = new Map<string, GameWithAtBats[]>()
                  for (const g of sortedGames) {
                    const [, m] = g.game_date.split('-')
                    const key = `${parseInt(m)}月`
                    if (!monthMap.has(key)) monthMap.set(key, [])
                    monthMap.get(key)!.push(g)
                  }
                  if (monthMap.size < 2) return null
                  const monthData = Array.from(monthMap.entries()).map(([month, mGames]) => {
                    const s = calcBattingStats(mGames.flatMap(g => g.at_bats))
                    return { month, avg: parseFloat((s.avg ?? 0).toFixed(3)), hits: s.hits, ab: s.ab }
                  })
                  return (
                    <div className={`${card} p-5`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">月別打率</h2>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={monthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                          <YAxis domain={[0, 0.5]} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} tickFormatter={(v: number) => v.toFixed(1)} />
                          <Tooltip formatter={(v: number, name: string) => [v.toFixed(3).replace(/^0/, ''), '打率']} />
                          <Bar dataKey="avg" fill="var(--theme)" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })()}

                {/* 10. 球場別成績 (L-3) */}
                {(() => {
                  const stadiumMap = new Map<string, GameWithAtBats[]>()
                  for (const g of games) {
                    if (!g.stadium) continue
                    if (!stadiumMap.has(g.stadium)) stadiumMap.set(g.stadium, [])
                    stadiumMap.get(g.stadium)!.push(g)
                  }
                  if (stadiumMap.size < 2) return null
                  const rows = Array.from(stadiumMap.entries())
                    .map(([stadium, sGames]) => {
                      const s = calcBattingStats(sGames.flatMap(g => g.at_bats))
                      return { stadium, games: sGames.length, avg: s.avg, hits: s.hits, hrs: s.hrs }
                    })
                    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
                    .slice(0, 5)
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">球場別成績（上位5）</h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-sub2 border-b border-s2">
                              <th className="text-left py-2">球場</th>
                              <th className="px-2 py-2">試合</th>
                              <th className="px-2 py-2">打率</th>
                              <th className="px-2 py-2">安打</th>
                              <th className="px-2 py-2">HR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-s2">
                            {rows.map(r => (
                              <tr key={r.stadium} className="text-center">
                                <td className="text-left py-2 text-main text-xs">{r.stadium}</td>
                                <td className="px-2 py-2 text-sub1">{r.games}</td>
                                <td className={`px-2 py-2 font-bold ${avgColor(r.avg)}`}>{fmtAvg(r.avg)}</td>
                                <td className="px-2 py-2 text-main">{r.hits}</td>
                                <td className="px-2 py-2 text-main">{r.hrs > 0 ? r.hrs : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}

                {/* 11. L6-3: マルチシーズン比較（「通算」表示時のみ） */}
                {season === 'all' && (() => {
                  const seasonMap = new Map<number, GameWithAtBats[]>()
                  for (const g of games) {
                    if (!seasonMap.has(g.season)) seasonMap.set(g.season, [])
                    seasonMap.get(g.season)!.push(g)
                  }
                  if (seasonMap.size < 2) return null
                  const seasonData = Array.from(seasonMap.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([yr, sGames]) => {
                      const s = calcBattingStats(sGames.flatMap(g => g.at_bats))
                      return {
                        year: `${yr}年`,
                        avg: s.avg != null ? parseFloat(s.avg.toFixed(3)) : 0,
                        ops: s.ops != null ? parseFloat(s.ops.toFixed(3)) : 0,
                        games: sGames.length,
                        hits: s.hits,
                        hrs: s.hrs,
                      }
                    })
                  return (
                    <div className={`${card} p-5 lg:col-span-2`}>
                      <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide mb-3">マルチシーズン比較</h2>
                      <div className="mb-4">
                        <p className="text-xs text-sub2 mb-2">打率推移</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={seasonData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                            <YAxis domain={[0, 0.5]} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} tickFormatter={(v: number) => v.toFixed(2)} />
                            <Tooltip formatter={(v: number) => [v.toFixed(3).replace(/^0/, ''), '打率']} />
                            <Bar dataKey="avg" fill="var(--theme)" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p className="text-xs text-sub2 mb-2">OPS推移</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={seasonData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border_lv2)" />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} />
                            <YAxis domain={[0, 1.5]} tick={{ fontSize: 11, fill: 'var(--sub_text_lv2)' }} tickFormatter={(v: number) => v.toFixed(1)} />
                            <Tooltip formatter={(v: number) => [v.toFixed(3).replace(/^0/, ''), 'OPS']} />
                            <Bar dataKey="ops" fill="var(--accent)" radius={[4,4,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 divide-y divide-s2">
                        {seasonData.map(d => (
                          <div key={d.year} className="flex items-center justify-between py-2 text-sm">
                            <span className="font-medium text-main w-16">{d.year}</span>
                            <span className="text-sub1">{d.games}試合</span>
                            <span className={`font-bold ${avgColor(d.avg)}`}>{d.avg > 0 ? d.avg.toFixed(3).replace(/^0/, '') : '---'}</span>
                            <span className={`font-bold ${opsColor(d.ops)}`}>OPS {d.ops > 0 ? d.ops.toFixed(3).replace(/^0/, '') : '---'}</span>
                            <span className="text-sub2">{d.hits}安 {d.hrs}HR</span>
                          </div>
                        ))}
                      </div>
                      {/* L7-5: 前シーズン比サマリーカード */}
                      {seasonData.length >= 2 && (() => {
                        const latest = seasonData[seasonData.length - 1]
                        const prev   = seasonData[seasonData.length - 2]
                        const avgDiff = latest.avg - prev.avg
                        const opsDiff = latest.ops - prev.ops
                        const hitsDiff = latest.hits - prev.hits
                        const hrsDiff  = latest.hrs - prev.hrs
                        const fmtRateDiff = (n: number) => {
                          const abs = Math.abs(n).toFixed(3).replace(/^0/, '')
                          return (n >= 0 ? '+' : '-') + abs
                        }
                        const fmtIntDiff = (n: number) => (n >= 0 ? '+' : '') + n
                        const diffCls = (n: number, threshold = 0.010) =>
                          n >= threshold ? 'text-pos-t' : n <= -threshold ? 'text-neg-t' : 'text-sub1'
                        return (
                          <div className="mt-3 pt-3 border-t border-s2 bg-lv2 rounded-lg p-3">
                            <p className="text-xs text-sub2 mb-2">
                              📊 前シーズン比 {prev.year} → {latest.year}
                            </p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              <span className={diffCls(avgDiff)}>
                                打率 {fmtRateDiff(avgDiff)}
                              </span>
                              <span className={diffCls(opsDiff)}>
                                OPS {fmtRateDiff(opsDiff)}
                              </span>
                              <span className={hitsDiff >= 0 ? 'text-pos-t' : 'text-neg-t'}>
                                安打 {fmtIntDiff(hitsDiff)}本
                              </span>
                              <span className={hrsDiff >= 0 ? 'text-pos-t' : 'text-neg-t'}>
                                HR {fmtIntDiff(hrsDiff)}本
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })()}

              </div>
            )
}
