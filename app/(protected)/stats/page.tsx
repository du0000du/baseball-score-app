'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, fmtAvg, fmtDec } from '@/lib/stats'
import { RESULT_TYPE_LABELS, DIRECTION_LABELS } from '@/lib/supabase/types'
import type { AtBat, Direction, Game, ResultType } from '@/lib/supabase/types'

interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}

type Tab = 'season' | 'per-game' | 'log'

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
      <div className="text-2xl font-bold text-navy-500">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}

export default function StatsPage() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const currentYear = new Date().getFullYear()
  const [season, setSeason] = useState(currentYear)
  const [games, setGames] = useState<GameWithAtBats[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('season')

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
      setLoading(false)
    }
    fetch()
  }, [season])

  const allAtBats = games.flatMap((g) => g.at_bats)
  const stats = calcBattingStats(allAtBats)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'season', label: 'シーズン累計' },
    { id: 'per-game', label: '試合ごと' },
    { id: 'log', label: '全打席ログ' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-500">打撃成績</h1>
        <select
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
      </div>

      {/* タブ */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-navy-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : allAtBats.length === 0 && tab === 'season' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-gray-400">{season}年のデータがありません</p>
        </div>
      ) : (
        <>
          {/* タブ1: シーズン累計 */}
          {tab === 'season' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="grid grid-cols-4 gap-4 mb-5">
                  <StatCard label="打率" value={fmtAvg(stats.avg)} />
                  <StatCard label="出塁率" value={fmtAvg(stats.obp)} />
                  <StatCard label="長打率" value={fmtAvg(stats.slg)} />
                  <StatCard label="OPS" value={fmtDec(stats.ops, 3).replace(/^0/, '')} />
                </div>
                <div className="grid grid-cols-6 gap-2 pt-4 border-t border-gray-100 text-center text-sm">
                  <div><div className="font-semibold">{games.length}</div><div className="text-xs text-gray-400">試合</div></div>
                  <div><div className="font-semibold">{stats.pa}</div><div className="text-xs text-gray-400">打席</div></div>
                  <div><div className="font-semibold">{stats.ab}</div><div className="text-xs text-gray-400">打数</div></div>
                  <div><div className="font-semibold">{stats.hits}</div><div className="text-xs text-gray-400">安打</div></div>
                  <div><div className="font-semibold">{stats.hrs}</div><div className="text-xs text-gray-400">本塁打</div></div>
                  <div><div className="font-semibold">{stats.rbi}</div><div className="text-xs text-gray-400">打点</div></div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-500 mb-4">内訳</h3>
                <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
                  {[
                    ['単打', stats.singles],
                    ['二塁打', stats.doubles],
                    ['三塁打', stats.triples],
                    ['本塁打', stats.hrs],
                    ['三振', stats.strikeouts],
                    ['四球', stats.walks],
                    ['死球', stats.hbp],
                    ['犠打', stats.sac_bunt],
                    ['犠飛', stats.sac_fly],
                    ['得点', stats.runs],
                    ['盗塁', stats.sb],
                    ['盗塁死', stats.cs],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-800">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-500 mb-4">セイバーメトリクス</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {[
                    ['ISO-D（出塁+）', fmtAvg(stats.isod)],
                    ['ISO-P（長打+）', fmtAvg(stats.isop)],
                    ['盗塁成功率', stats.sb_pct !== null ? (stats.sb_pct * 100).toFixed(1) + '%' : '---'],
                    ['RC27', fmtDec(stats.rc27, 2)],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-medium text-gray-800">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* タブ2: 試合ごと */}
          {tab === 'per-game' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {games.length === 0 ? (
                <div className="p-12 text-center text-gray-400">試合データがありません</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs">
                        <th className="text-left px-4 py-3 font-medium">日付</th>
                        <th className="text-left px-4 py-3 font-medium">相手</th>
                        <th className="px-3 py-3 font-medium">結果</th>
                        <th className="px-3 py-3 font-medium">打席</th>
                        <th className="px-3 py-3 font-medium">打数</th>
                        <th className="px-3 py-3 font-medium">安打</th>
                        <th className="px-3 py-3 font-medium">打率</th>
                        <th className="px-3 py-3 font-medium">打点</th>
                        <th className="px-3 py-3 font-medium">三振</th>
                        <th className="px-3 py-3 font-medium">四球</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {games.map((game) => {
                        const gs = calcBattingStats(game.at_bats)
                        return (
                          <tr key={game.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">{formatDate(game.game_date)}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{game.opponent}</td>
                            <td className="px-3 py-3 text-center">
                              <ResultBadge result={game.result} />
                            </td>
                            <td className="px-3 py-3 text-center text-gray-700">{gs.pa}</td>
                            <td className="px-3 py-3 text-center text-gray-700">{gs.ab}</td>
                            <td className="px-3 py-3 text-center text-gray-700">{gs.hits}</td>
                            <td className="px-3 py-3 text-center font-medium text-navy-500">{fmtAvg(gs.avg)}</td>
                            <td className="px-3 py-3 text-center text-gray-700">{gs.rbi}</td>
                            <td className="px-3 py-3 text-center text-gray-700">{gs.strikeouts}</td>
                            <td className="px-3 py-3 text-center text-gray-700">{gs.walks}</td>
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                        <th className="px-3 py-3 font-medium">得点</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {games.flatMap((game) =>
                        game.at_bats.map((ab) => (
                          <tr key={ab.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(game.game_date)}</td>
                            <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{game.opponent}</td>
                            <td className="px-3 py-2.5 text-center text-gray-500">#{ab.at_bat_number}</td>
                            <td className="px-3 py-2.5 text-center text-gray-700">{ab.batting_order}番</td>
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
                              {ab.is_rbi ? <span className="text-orange-500 font-bold">●</span> : <span className="text-gray-200">-</span>}
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
            