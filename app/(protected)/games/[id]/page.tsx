'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcBattingStats, calcPitchingStats, fmtAvg, fmtERA, formatIP } from '@/lib/stats'
import { getAtBatLabel, DIRECTION_LABELS } from '@/lib/supabase/types'
import type { AtBat, Game, PitchingStat, Direction, ResultType } from '@/lib/supabase/types'

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

const PITCHING_RESULT_LABELS: Record<string, string> = {
  win: '勝利', loss: '敗戦', save: 'セーブ', hold: 'ホールド', none: '-',
}

export default function GameDetailPage() {
  const params = useParams()
  const gameId = params.id as string
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [game, setGame] = useState<Game | null>(null)
  const [atBats, setAtBats] = useState<AtBat[]>([])
  const [pitching, setPitching] = useState<PitchingStat | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: g }, { data: ab }, { data: ps }] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('at_bats').select('*').eq('game_id', gameId).order('at_bat_number'),
        supabase.from('pitching_stats').select('*').eq('game_id', gameId).maybeSingle(),
      ])
      setGame(g)
      setAtBats(ab ?? [])
      setPitching(ps)
      setLoading(false)
    }
    load()
  }, [gameId, supabase])

  if (loading) {
    return <div className="min-h-[520px] flex items-center justify-center text-sub2">読み込み中...</div>
  }

  if (!game) {
    return (
      <div className="text-center py-12">
        <p className="text-sub2">試合が見つかりません</p>
        <Link href="/games" className="text-accent hover:underline mt-2 block">試合一覧へ</Link>
      </div>
    )
  }

  const batting = calcBattingStats(atBats)
  const pStats = pitching ? calcPitchingStats([pitching]) : null

  const resultMark = game.result === 'win' ? '○' : game.result === 'loss' ? '●' : '△'
  const resultLabel = game.result === 'win' ? '勝利' : game.result === 'loss' ? '敗戦' : '引き分け'
  const resultTextClass = game.result === 'win'
    ? 'text-green-300 dark:text-green-500'
    : game.result === 'loss'
    ? 'text-white/60 dark:text-sub2'
    : 'text-yellow-300 dark:text-yellow-500'

  const card = 'bg-lv1 rounded-xl shadow-sm border border-s2'
  const sectionTitle = 'text-sm font-semibold text-sub1 uppercase tracking-wide'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* 戻るリンク */}
      <Link href="/games" className="text-sub2 hover:text-main transition-colors text-sm flex items-center gap-1">
        ← 試合一覧
      </Link>

      {/* 試合ヘッダー */}
      <div className="bg-theme dark:bg-lv1 border border-theme/30 dark:border-s2 rounded-xl p-4 text-white dark:text-main">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-white/80 dark:text-sub1">{formatDate(game.game_date)}</div>
            {game.stadium && (
              <div className="text-xs text-white/70 dark:text-sub2 mt-0.5">📍 {game.stadium}</div>
            )}
            <div className="text-xl font-bold mt-1 truncate">vs {game.opponent}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-3xl font-bold tabular-nums">
              {game.score_us}
              <span className="text-white/40 dark:text-sub2 mx-1 text-xl font-normal">-</span>
              {game.score_them}
            </div>
            <div className={`text-base font-bold mt-0.5 ${resultTextClass}`}>
              {resultMark} {resultLabel}
            </div>
          </div>
        </div>
        {game.notes && (
          <div className="mt-3 text-sm text-white/70 dark:text-sub2 border-t border-white/20 dark:border-s2 pt-2">
            {game.notes}
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href={`/games/${game.id}/at-bats`}
          className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-semibold text-sm bg-pos text-pos-t border border-pos/40 hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="text-2xl leading-none">🏏</span>
          <span>打席入力</span>
        </Link>
        <Link
          href={`/games/${game.id}/pitching`}
          className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-semibold text-sm bg-theme text-white hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="text-2xl leading-none">⚾</span>
          <span>投球入力</span>
        </Link>
        <Link
          href={`/games/${game.id}/edit`}
          className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl font-semibold text-sm bg-lv2 text-main border border-s2 hover:bg-s2 transition-colors shadow-sm"
        >
          <span className="text-2xl leading-none">✏️</span>
          <span>編集</span>
        </Link>
      </div>

      {/* 打撃成績 */}
      <div className={`${card} p-4`}>
        <h2 className={`${sectionTitle} mb-3`}>打撃成績</h2>

        {atBats.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sub2 text-sm mb-2">打席記録がありません</p>
            <Link href={`/games/${game.id}/at-bats`} className="text-accent text-sm hover:underline">
              打席を入力する →
            </Link>
          </div>
        ) : (
          <>
            {/* 集計 */}
            <div className="grid grid-cols-8 gap-1 text-center text-xs bg-lv2 rounded-lg p-3 mb-3">
              <div>
                <div className="font-bold text-sm text-accent">{fmtAvg(batting.avg)}</div>
                <div className="text-sub2 mt-0.5">打率</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{batting.ab}</div>
                <div className="text-sub2 mt-0.5">打数</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{batting.hits}</div>
                <div className="text-sub2 mt-0.5">安打</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{batting.hrs}</div>
                <div className="text-sub2 mt-0.5">HR</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{batting.rbi}</div>
                <div className="text-sub2 mt-0.5">打点</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{batting.sb}</div>
                <div className="text-sub2 mt-0.5">盗塁</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{batting.strikeouts}</div>
                <div className="text-sub2 mt-0.5">三振</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{batting.walks + batting.hbp}</div>
                <div className="text-sub2 mt-0.5">四死球</div>
              </div>
            </div>

            {/* 打席リスト */}
            <div className="space-y-1.5">
              {atBats.map((ab) => {
                const label = getAtBatLabel(ab.result_type as ResultType, ab.direction as Direction | null)
                const isHit = ['hit', 'double', 'triple', 'hr'].includes(ab.result_type)
                const rbiVal = ab.rbi_count ?? (ab.is_rbi ? 1 : 0)
                const sbVal = ab.stolen_base_count ?? (ab.is_stolen_base ? 1 : 0)
                return (
                  <div key={ab.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-lv2">
                    <span className="text-xs text-sub2 w-5 shrink-0 text-right">{ab.at_bat_number}</span>
                    <span className="text-xs bg-theme/15 text-accent px-1.5 py-0.5 rounded font-medium shrink-0 w-9 text-center">
                      {ab.batting_order}番
                    </span>
                    <span className={`text-sm font-medium flex-1 min-w-0 truncate ${isHit ? 'text-green-600 dark:text-green-400' : 'text-main'}`}>
                      {label}
                    </span>
                    <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                      {rbiVal > 0 && (
                        <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">
                          打点{rbiVal > 1 ? rbiVal : ''}
                        </span>
                      )}
                      {ab.is_run && (
                        <span className="text-xs bg-theme/10 text-theme px-1.5 py-0.5 rounded">得点</span>
                      )}
                      {sbVal > 0 && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                          盗塁{sbVal > 1 ? sbVal : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 投手成績 */}
      <div className={`${card} p-4`}>
        <h2 className={`${sectionTitle} mb-3`}>投手成績</h2>

        {!pitching ? (
          <div className="text-center py-4">
            <p className="text-sub2 text-sm mb-2">投手成績が記録されていません</p>
            <Link href={`/games/${game.id}/pitching`} className="text-accent text-sm hover:underline">
              投手成績を入力する →
            </Link>
          </div>
        ) : (
          <>
            {/* 主要スタッツ */}
            <div className="grid grid-cols-4 gap-1 text-center text-xs bg-lv2 rounded-lg p-3 mb-3">
              <div>
                <div className="font-bold text-sm text-accent">{fmtERA(pStats!.era)}</div>
                <div className="text-sub2 mt-0.5">防御率</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{formatIP(pitching.innings_pitched)}</div>
                <div className="text-sub2 mt-0.5">投球回</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{pitching.strikeouts}</div>
                <div className="text-sub2 mt-0.5">奪三振</div>
              </div>
              <div>
                <div className="font-semibold text-main text-sm">{pitching.earned_runs}</div>
                <div className="text-sub2 mt-0.5">自責点</div>
              </div>
            </div>

            {/* 詳細スタッツ */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { label: '登板結果', value: PITCHING_RESULT_LABELS[pitching.result] ?? '-' },
                { label: '被安打', value: pitching.hits_allowed },
                { label: '被本塁打', value: pitching.home_runs_allowed },
                { label: '与四球', value: pitching.walks },
                { label: '与死球', value: pitching.hit_batsmen },
                { label: '失点', value: pitching.runs_allowed },
                ...(pitching.complete_game ? [{ label: '完投', value: '○' }] : []),
                ...(pitching.pitch_count !== null ? [{ label: '投球数', value: pitching.pitch_count }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="bg-lv2 rounded-lg py-2.5 px-1">
                  <div className="font-semibold text-main text-sm">{value}</div>
                  <div className="text-sub2 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
