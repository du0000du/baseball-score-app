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
// P-1: SVGチャート専用セマンティックカラー定数（5色に拡張）
// ※ SVG stroke/fill に Tailwind クラスが使えないため例外的に定義
// ※ 変更する場合はここだけ修正すること
// ────────────────────────────────────────────────
const SPRAY_COLORS = {
  hr:      '#E53935', // 本塁打 - 赤
  triple:  '#8E24AA', // 三塁打 - 紫
  double:  '#F57C00', // 二塁打 - オレンジ
  single:  '#1E88E5', // 単打   - 青
  out:     '#757575', // 凡打・その他 - グレー
} as const

// ────────────────────────────────────────────────
// P-3: 方向別ゲージカラー（各方向を色で識別）
// ────────────────────────────────────────────────
const GAUGE_COLORS: Record<string, string> = {
  left:         '#1E88E5', // 左   - 青
  left_center:  '#43A047', // 左中 - 緑
  center:       '#FB8C00', // 中   - オレンジ
  right_center: '#43A047', // 右中 - 緑
  right:        '#1E88E5', // 右   - 青
  infield:      '#757575', // 内野 - グレー
}

// ────────────────────────────────────────────────
// フィールド定数（SVG 座標系）
// ────────────────────────────────────────────────
const HX = 180  // ホームベース X（viewBox 中央）
const HY = 295  // ホームベース Y（下端寄り）
const FENCE_R = 262  // 外野フェンス半径（px）
const BASE_DIST = 88  // ベース間距離（px）
const DEG42 = (42 * Math.PI) / 180

const BASES = {
  first:   { x: HX + BASE_DIST * Math.sin(DEG42), y: HY - BASE_DIST * Math.cos(DEG42) },
  second:  { x: HX,                                y: HY - BASE_DIST * Math.SQRT2 },
  third:   { x: HX - BASE_DIST * Math.sin(DEG42), y: HY - BASE_DIST * Math.cos(DEG42) },
  pitcher: { x: HX,                                y: HY - BASE_DIST * 0.665 },
}

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
  // strikeout / walk / hbp → 描画しない
}

// ────────────────────────────────────────────────
// P-1: 5色対応 getSprayColor
// ────────────────────────────────────────────────
function getSprayColor(rt: ResultType): string | null {
  if (rt === 'hr')                          return SPRAY_COLORS.hr
  if (rt === 'triple')                      return SPRAY_COLORS.triple
  if (rt === 'double')                      return SPRAY_COLORS.double
  if (rt === 'hit')                         return SPRAY_COLORS.single
  if (RESULT_DISTANCE_PX[rt] !== undefined) return SPRAY_COLORS.out
  return null  // strikeout / walk / hbp → 描画しない
}

type ViewMode     = 'line' | 'dot'
type ResultFilter = 'all' | 'long_hit' | 'single' | 'out'

const INFIELD_DIRS = new Set(['pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop'])

function matchesFilter(rt: ResultType, filt: ResultFilter): boolean {
  if (filt === 'all')      return true
  if (filt === 'long_hit') return ['double', 'triple', 'hr'].includes(rt)
  if (filt === 'single')   return rt === 'hit'
  if (filt === 'out')      return !!RESULT_DISTANCE_PX[rt] && !['double', 'triple', 'hr', 'hit'].includes(rt)
  return true
}

// ────────────────────────────────────────────────
// P-2: 同方向扇形展開
// ────────────────────────────────────────────────
const SPREAD_DEG     = 1.8  // 1本ずつずらす角度（度）
const MAX_HALF_SPREAD = 6   // 最大片側 ±6°

function calcLineOffset(indexInGroup: number, groupSize: number): number {
  if (groupSize <= 1) return 0
  const halfSpread = Math.min((groupSize - 1) * SPREAD_DEG / 2, MAX_HALF_SPREAD)
  const step = halfSpread * 2 / (groupSize - 1)
  return -halfSpread + indexInGroup * step
}

// P-2: offsetDeg 対応の終点計算（ライン用）
function calcEndpoint(dir: string, rt: ResultType, offsetDeg = 0): { x: number; y: number } | null {
  const angleDeg = DIRECTION_ANGLE_DEG[dir]
  const dist     = RESULT_DISTANCE_PX[rt]
  if (angleDeg === undefined || !dist) return null
  const rad = ((angleDeg + offsetDeg) * Math.PI) / 180
  return { x: HX + dist * Math.sin(rad), y: HY - dist * Math.cos(rad) }
}

// ────────────────────────────────────────────────
// P-5: ドット専用終点計算（ファウルライン回避オフセット）
// left/right のドットをフェアゾーン寄りに 6° ずらす
// ────────────────────────────────────────────────
const DOT_ANGLE_OFFSET: Partial<Record<string, number>> = {
  left:  6,   // -42° → -36°（フェアゾーン寄り）
  right: -6,  // +42° → +36°（フェアゾーン寄り）
}

function calcDotEndpoint(dir: string, rt: ResultType): { x: number; y: number } | null {
  const angleDeg = DIRECTION_ANGLE_DEG[dir]
  const dist     = RESULT_DISTANCE_PX[rt]
  if (angleDeg === undefined || !dist) return null
  const offset = DOT_ANGLE_OFFSET[dir] ?? 0
  const rad = ((angleDeg + offset) * Math.PI) / 180
  return { x: HX + dist * Math.sin(rad), y: HY - dist * Math.cos(rad) }
}

// ────────────────────────────────────────────────
// SVG フィールドパス（定数）
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

  // P-2: 同一 direction ごとに扇形オフセットを付与
  const plottableWithOffset = useMemo(() => {
    const dirCounter: Record<string, number> = {}
    const dirGroupSizes: Record<string, number> = {}
    for (const ab of plottable) {
      const key = ab.direction!
      dirGroupSizes[key] = (dirGroupSizes[key] ?? 0) + 1
    }
    return plottable.map(ab => {
      const key = ab.direction!
      const idx = dirCounter[key] ?? 0
      dirCounter[key] = idx + 1
      return { ...ab, offsetDeg: calcLineOffset(idx, dirGroupSizes[key]) }
    })
  }, [plottable])

  // サマリー集計（P-1: 本・三・二・単を個別集計）
  const summary = useMemo(() => {
    const total   = allAtBats.length
    const hrs     = allAtBats.filter(ab => ab.result_type === 'hr').length
    const triples = allAtBats.filter(ab => ab.result_type === 'triple').length
    const doubles = allAtBats.filter(ab => ab.result_type === 'double').length
    const singles = allAtBats.filter(ab => ab.result_type === 'hit').length
    const longHits = hrs + triples + doubles
    const hits     = longHits + singles
    const abCount  = allAtBats.filter(ab =>
      !['walk', 'hbp', 'sac_bunt', 'sac_fly'].includes(ab.result_type)
    ).length
    const avg    = abCount > 0 ? hits / abCount : 0
    const avgStr = avg.toFixed(3).replace('0.', '.')
    const outs   = abCount - hits
    return { total, hits, longHits, singles, hrs, triples, doubles, abCount, avgStr, outs }
  }, [allAtBats])

  // 方向別集計
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

  const maxDirCount  = Math.max(...Object.values(dirCounts), 1)
  const hasPlottable = plottableWithOffset.length > 0
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

      {/* 結果フィルター（長打ボタンは代表色=赤で表示） */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          { key: 'all'      as ResultFilter, label: 'すべて', color: null               },
          { key: 'long_hit' as ResultFilter, label: '長打',   color: SPRAY_COLORS.hr    },
          { key: 'single'   as ResultFilter, label: '単打',   color: SPRAY_COLORS.single },
          { key: 'out'      as ResultFilter, label: '凡打',   color: SPRAY_COLORS.out   },
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
          {/* フィールド背景 */}
          <path d={fieldOutline} fill="#4a7c59" />
          <path d={infieldDiamond} fill="#c8a87a" />
          <line x1={HX} y1={HY} x2={f(LF.x)} y2={f(LF.y)} stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1={HX} y1={HY} x2={f(RF.x)} y2={f(RF.y)} stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
          <path d={fenceArc} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
          <circle cx={f(BASES.pitcher.x)} cy={f(BASES.pitcher.y)} r="10" fill="#b8986a" />
          {[BASES.first, BASES.second, BASES.third].map((b, i) => (
            <rect
              key={i}
              x={b.x - 4} y={b.y - 4}
              width="8" height="8"
              fill="white" fillOpacity="0.85"
              transform={`rotate(45, ${b.x}, ${b.y})`}
            />
          ))}
          <polygon
            points={`${HX},${HY - 6} ${HX + 5},${HY} ${HX + 4},${HY + 4} ${HX - 4},${HY + 4} ${HX - 5},${HY}`}
            fill="white" fillOpacity="0.85"
          />

          {/* 打球描画 */}
          {plottableWithOffset.map(ab => {
            if (!ab.direction) return null
            const color = getSprayColor(ab.result_type)
            if (!color) return null

            if (viewMode === 'line') {
              // P-2: 扇形オフセット付き終点、太い線
              const ep = calcEndpoint(ab.direction, ab.result_type, ab.offsetDeg)
              if (!ep) return null
              return (
                <line
                  key={ab.id}
                  x1={HX} y1={HY}
                  x2={f(ep.x)} y2={f(ep.y)}
                  stroke={color}
                  strokeWidth="3.5"
                  strokeOpacity="0.65"
                  strokeLinecap="round"
                />
              )
            } else {
              // P-4: 大きなドット・高コントラスト、P-5: ファウルライン回避オフセット
              const ep = calcDotEndpoint(ab.direction, ab.result_type)
              if (!ep) return null
              return (
                <circle
                  key={ab.id}
                  cx={f(ep.x)} cy={f(ep.y)}
                  r="8"
                  fill={color}
                  fillOpacity="0.82"
                  stroke="white"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />
              )
            }
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

        {/* P-1: 5色凡例（左下オーバーレイ） */}
        <div className="absolute left-2 bottom-2 bg-lv1/85 rounded-lg px-2 py-1.5 space-y-1">
          {([
            { label: '本塁打', color: SPRAY_COLORS.hr     },
            { label: '三塁打', color: SPRAY_COLORS.triple },
            { label: '二塁打', color: SPRAY_COLORS.double },
            { label: '単打',   color: SPRAY_COLORS.single },
            { label: '凡打',   color: SPRAY_COLORS.out    },
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

      {/* P-1: サマリー（本・三・二・単 を個別表示） */}
      <p className="text-xs text-sub2 text-center leading-relaxed">
        計 <span className="font-semibold text-main">{summary.total}</span>打席
        安打 <span className="font-semibold text-main">{summary.hits}</span>（
        <span className="font-semibold" style={{ color: SPRAY_COLORS.hr }}>本{summary.hrs}</span>・
        <span className="font-semibold" style={{ color: SPRAY_COLORS.triple }}>三{summary.triples}</span>・
        <span className="font-semibold" style={{ color: SPRAY_COLORS.double }}>二{summary.doubles}</span>・
        <span className="font-semibold" style={{ color: SPRAY_COLORS.single }}>単{summary.singles}</span>）
        凡打 <span className="font-semibold text-main">{summary.outs}</span>
        打率 <span className="font-semibold text-main">{summary.avgStr}</span>
      </p>

      {/* P-3: 方向別ゲージバーグラフ（溝 + フィルバー + 目盛り） */}
      <div className="bg-lv2 rounded-xl p-3 space-y-2">
        <p className="text-[10px] text-sub2 font-medium">方向別打球数</p>
        {([
          { key: 'left',         label: '左'   },
          { key: 'left_center',  label: '左中' },
          { key: 'center',       label: '中'   },
          { key: 'right_center', label: '右中' },
          { key: 'right',        label: '右'   },
          { key: 'infield',      label: '内野' },
        ] as const).map(({ key, label }) => {
          const count = dirCounts[key] ?? 0
          const pct   = (count / maxDirCount) * 100
          const color = GAUGE_COLORS[key]
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-sub2 w-6 text-right shrink-0">{label}</span>
              {/* ゲージトラック（溝） */}
              <div className="relative flex-1 h-3.5 bg-lv1 rounded-full overflow-hidden border border-s2">
                {/* フィルバー */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }}
                />
                {/* 目盛り線（25% / 50% / 75%） */}
                {[25, 50, 75].map(tick => (
                  <div
                    key={tick}
                    className="absolute inset-y-0 w-px bg-s2/60"
                    style={{ left: `${tick}%` }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-main w-4 shrink-0 text-right">{count}</span>
            </div>
          )
        })}
      </div>

    </div>
  )
}
