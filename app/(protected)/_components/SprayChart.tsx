'use client'

import { useState, useMemo } from 'react'
import type { AtBat, Game, ResultType } from '@/lib/supabase/types'

// ────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────
interface GameWithAtBats extends Game {
  at_bats: AtBat[]
}
interface Props {
  games: GameWithAtBats[]
}

// ────────────────────────────────────────────────
// SVGチャート専用セマンティックカラー定数
// ※ SVG stroke/fill に Tailwind クラスが適用できないため例外的に定義
// ※ 変更する場合はここだけ修正すること
// ────────────────────────────────────────────────
const SPRAY_COLORS = {
  long_hit: '#E53935', // 長打（二塁打・三塁打・本塁打）
  single:   '#1E88E5', // 単打
  out:      '#757575', // 凡打・その他
} as const

// ────────────────────────────────────────────────
// フィールド定数（SVG 座標系）
// ────────────────────────────────────────────────
const HX = 180  // ホームベース X（viewBox 中央）
const HY = 295  // ホームベース Y（下端寄り）
const FENCE_R = 262  // 外野フェンス半径（px）
const BASE_DIST = 88  // ベース間距離（px）
const DEG42 = (42 * Math.PI) / 180

// ベース座標
const BASES = {
  first:   { x: HX + BASE_DIST * Math.sin(DEG42), y: HY - BASE_DIST * Math.cos(DEG42) },
  second:  { x: HX,                                y: HY - BASE_DIST * Math.SQRT2 },
  third:   { x: HX - BASE_DIST * Math.sin(DEG42), y: HY - BASE_DIST * Math.cos(DEG42) },
  pitcher: { x: HX,                                y: HY - BASE_DIST * 0.665 },
}

// ファウルライン端点
const LF = { x: HX - FENCE_R * Math.sin(DEG42), y: HY - FENCE_R * Math.cos(DEG42) }
const RF = { x: HX + FENCE_R * Math.sin(DEG42), y: HY - FENCE_R * Math.cos(DEG42) }

const f = (n: number) => n.toFixed(1)

// ────────────────────────────────────────────────
// 方向 → 角度（垂直=0°, 右が正, 左が負）
// ────────────────────────────────────────────────
const DIRECTION_ANGLE_DEG: Record<string, number> = {
  left:         -42,
  left_center:  -21,
  center:         0,
  right_center:  21,
  right:         42,
  third_base:   -37,
  shortstop:    -20,
  pitcher:        2,
  second_base:    9,
  first_base:    30,
  catcher:        4,
}

// ────────────────────────────────────────────────
// result_type → 飛距離（px）
// ────────────────────────────────────────────────
const RESULT_DISTANCE_PX: Partial<Record<ResultType, number>> = {
  hr:             275,
  triple:         235,
  double:         200,
  hit:            162,
  flyout:         182,
  liner_out:      170,
  sac_fly:        192,
  groundout:       95,
  sac_bunt:        52,
  infield_flyout:  80,
  error:          102,
  fc:              92,
  // strikeout / walk / hbp: 0 → 描画しない
}

// ────────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────────
function getSprayColor(rt: ResultType): string | null {
  if (['double', 'triple', 'hr'].includes(rt)) return SPRAY_COLORS.long_hit
  if (rt === 'hit')                             return SPRAY_COLORS.single
  if (RESULT_DISTANCE_PX[rt] !== undefined)     return SPRAY_COLORS.out
  return null  // strikeout / walk / hbp → 描画しない
}

type ViewMode     = 'line' | 'dot'
type ResultFilter = 'all' | 'long_hit' | 'single' | 'out'

const INFIELD_DIRS = new Set(['pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop'])

function matchesFilter(rt: ResultType, f: ResultFilter): boolean {
  if (f === 'all')      return true
  if (f === 'long_hit') return ['double', 'triple', 'hr'].includes(rt)
  if (f === 'single')   return rt === 'hit'
  if (f === 'out')      return !!RESULT_DISTANCE_PX[rt] && !['double', 'triple', 'hr', 'hit'].includes(rt)
  return true
}

function calcEndpoint(dir: string, rt: ResultType): { x: number; y: number } | null {
  const angleDeg = DIRECTION_ANGLE_DEG[dir]
  const dist     = RESULT_DISTANCE_PX[rt]
  if (angleDeg === undefined || !dist) return null
  const rad = (angleDeg * Math.PI) / 180
  return { x: HX + dist * Math.sin(rad), y: HY - dist * Math.cos(rad) }
}

// ────────────────────────────────────────────────
// SVG フィールドパス
// ────────────────────────────────────────────────
const fieldOutline = [
  `M ${f(LF.x)} ${f(LF.y)}`,
  `A ${FENCE_R} ${FENCE_R} 0 0 1 ${f(RF.x)} ${f(RF.y)}`,
  `L ${HX} ${HY} Z`,
].join(' ')

const fenceArc = [
  `M ${f(LF.x)} ${f(LF.y)}`,
  `A ${FENCE_R} ${FENCE_R} 0 0 1 ${f(RF.x)} ${f(RF.y)}`,
].join(' ')

const infieldDiamond = [
  `M ${HX} ${HY}`,
  `L ${f(BASES.first.x)} ${f(BASES.first.y)}`,
  `L ${f(BASES.second.x)} ${f(BASES.second.y)}`,
  `L ${f(BASES.third.x)} ${f(BASES.third.y)}`,
  'Z',
].join(' ')

// ────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────
export default function SprayChart({ games }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('line')
  const [filter, setFilter]     = useState<ResultFilter>('all')

  const allAtBats = useMemo(() => games.flatMap(g => g.at_bats), [games])

  // 描画対象（direction あり・カラーあり・フィルター適用済み）
  const plottable = useMemo(() =>
    allAtBats.filter(ab =>
      ab.direction !== null &&
      ab.direction !== undefined &&
      getSprayColor(ab.result_type) !== null &&
      matchesFilter(ab.result_type, filter)
    ),
    [allAtBats, filter]
  )

  // サマリー集計
  const summary = useMemo(() => {
    const total    = allAtBats.length
    const longHits = allAtBats.filter(ab => ['double', 'triple', 'hr'].includes(ab.result_type)).length
    const singles  = allAtBats.filter(ab => ab.result_type === 'hit').length
    const hits     = longHits + singles
    const abCount  = allAtBats.filter(ab =>
      !['walk', 'hbp', 'sac_bunt', 'sac_fly'].includes(ab.result_type)
    ).length
    const avg    = abCount > 0 ? hits / abCount : 0
    const avgStr = avg.toFixed(3).replace('0.', '.')
    const outs   = abCount - hits
    return { total, hits, longHits, singles, abCount, avgStr, outs }
  }, [allAtBats])

  // 方向別集計（外野5方向 + 内野）
  const dirCounts = useMemo(() => {
    const counts: Record<string, number> = {
      left: 0, left_center: 0, center: 0, right_center: 0, right: 0, infield: 0,
    }
    for (const ab of allAtBats) {
      if (!ab.direction) continue
      if (INFIELD_DIRS.has(ab.direction)) counts.infield++
      else if (counts[ab.direction] !== undefined) counts[ab.direction]++
    }
    return counts
  }, [allAtBats])

  const maxDirCount = Math.max(...Object.values(dirCounts), 1)
  const hasPlottable = plottable.length > 0
  const hasAnyDir    = allAtBats.some(ab => ab.direction)

  return (
    <div className="space-y-2">

      {/* ビューモード切替 */}
      <div className="flex items-center gap-1 bg-lv2 rounded-lg p-1 w-fit">
        {(['line', 'dot'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === mode
                ? 'bg-theme text-theme-t font-medium shadow-sm'
                : 'text-sub2'
            }`}
          >
            {mode === 'line' ? 'ライン' : 'ドット'}
          </button>
        ))}
      </div>

      {/* 結果フィルター */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { key: 'all'     as ResultFilter, label: 'すべて', color: null              },
          { key: 'long_hit'as ResultFilter, label: '長打',   color: SPRAY_COLORS.long_hit },
          { key: 'single'  as ResultFilter, label: '単打',   color: SPRAY_COLORS.single   },
          { key: 'out'     as ResultFilter, label: '凡打',   color: SPRAY_COLORS.out      },
        ]).map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              filter === key
                ? 'border-transparent font-medium'
                : 'border-s2 text-sub2 bg-lv2'
            }`}
            style={
              filter === key
                ? color
                  ? { backgroundColor: color + '22', color, borderColor: color + '55' }
                  : { backgroundColor: 'var(--theme)', color: 'var(--theme-t)' }
                : {}
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* SVG スプレーチャート */}
      <div className="relative w-full" style={{ aspectRatio: '360 / 310' }}>
        <svg
          viewBox="0 0 360 310"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-label="スプレーチャート"
        >
          {/* 外野グラス */}
          <path d={fieldOutline} fill="#4a7c59" />
          {/* 内野土 */}
          <path d={infieldDiamond} fill="#c8a87a" />
          {/* ファウルライン */}
          <line x1={HX} y1={HY} x2={f(LF.x)} y2={f(LF.y)} stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1={HX} y1={HY} x2={f(RF.x)} y2={f(RF.y)} stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
          {/* 外野フェンス */}
          <path d={fenceArc} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
          {/* ピッチャーズサークル */}
          <circle cx={f(BASES.pitcher.x)} cy={f(BASES.pitcher.y)} r="10" fill="#b8986a" />
          {/* 塁マーカー */}
          {[BASES.first, BASES.second, BASES.third].map((b, i) => (
            <rect
              key={i}
              x={b.x - 4} y={b.y - 4}
              width="8" height="8"
              fill="white" fillOpacity="0.85"
              transform={`rotate(45, ${b.x}, ${b.y})`}
            />
          ))}
          {/* ホームベース */}
          <polygon
            points={`${HX},${HY - 6} ${HX + 5},${HY} ${HX + 4},${HY + 4} ${HX - 4},${HY + 4} ${HX - 5},${HY}`}
            fill="white" fillOpacity="0.85"
          />

          {/* 打球描画 */}
          {plottable.map(ab => {
            if (!ab.direction) return null
            const ep    = calcEndpoint(ab.direction, ab.result_type)
            const color = getSprayColor(ab.result_type)
            if (!ep || !color) return null
            return viewMode === 'line' ? (
              <line
                key={ab.id}
                x1={HX} y1={HY}
                x2={f(ep.x)} y2={f(ep.y)}
                stroke={color} strokeWidth="2.5" strokeOpacity="0.55"
                strokeLinecap="round"
              />
            ) : (
              <circle
                key={ab.id}
                cx={f(ep.x)} cy={f(ep.y)}
                r="4.5"
                fill={color} fillOpacity="0.55"
              />
            )
          })}

          {/* データなしオーバーレイ */}
          {!hasAnyDir && (
            <text x="180" y="165" textAnchor="middle" fontSize="13" fill="white" fillOpacity="0.85">
              打球方向データがありません
            </text>
          )}
          {hasAnyDir && !hasPlottable && (
            <text x="180" y="165" textAnchor="middle" fontSize="13" fill="white" fillOpacity="0.85">
              該当する打席がありません
            </text>
          )}
        </svg>

        {/* 凡例（左下オーバーレイ） */}
        <div className="absolute left-2 bottom-2 bg-lv1/85 rounded-lg px-2 py-1.5 space-y-1">
          {([
            { label: '長打', color: SPRAY_COLORS.long_hit },
            { label: '単打', color: SPRAY_COLORS.single   },
            { label: '凡打', color: SPRAY_COLORS.out      },
          ] as const).map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <svg width="16" height="4" aria-hidden="true">
                <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] text-sub2">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* サマリー1行 */}
      <p className="text-xs text-sub2 text-center leading-relaxed">
        計 <span className="font-semibold text-main">{summary.total}</span>打席
        安打 <span className="font-semibold text-main">{summary.hits}</span>（
        長打 <span className="font-semibold" style={{ color: SPRAY_COLORS.long_hit }}>{summary.longHits}</span>・
        単打 <span className="font-semibold" style={{ color: SPRAY_COLORS.single }}>{summary.singles}</span>）
        凡打 <span className="font-semibold text-main">{summary.outs}</span>
        打率 <span className="font-semibold text-main">{summary.avgStr}</span>
      </p>

      {/* 方向別ミニバーグラフ */}
      <div className="bg-lv2 rounded-xl p-3 space-y-1.5">
        <p className="text-[10px] text-sub2 font-medium mb-1.5">方向別打球数</p>
        {([
          { key: 'left',        label: '左'   },
          { key: 'left_center', label: '左中' },
          { key: 'center',      label: '中'   },
          { key: 'right_center',label: '右中' },
          { key: 'right',       label: '右'   },
          { key: 'infield',     label: '内野' },
        ] as const).map(({ key, label }) => {
          const count = dirCounts[key] ?? 0
          const pct   = (count / maxDirCount) * 100
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-sub2 w-6 text-right shrink-0">{label}</span>
              <div className="flex-1 bg-lv1 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-theme/60 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-main w-4 shrink-0 text-right">{count}</span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
