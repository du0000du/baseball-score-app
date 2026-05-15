'use client'

import { useState, useMemo } from 'react'
import type { AtBat, Game, ResultType } from '@/lib/supabase/types'
import { useTheme } from '@/app/(protected)/_components/ThemeProvider'

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
// P-1 / P-9: SVGチャート専用セマンティックカラー定数
// ※ SVG stroke/fill に Tailwind クラスが使えないため例外的に定義
// ※ P-9: 芝(#2D5A3D/#4a7c59)の上で識別できる明るい系統色に更新
// ────────────────────────────────────────────────
const SPRAY_COLORS = {
  hr:     '#FF5252', // 本塁打 - 明るい赤     (旧: #E53935)
  triple: '#CE93D8', // 三塁打 - 明るい紫     (旧: #8E24AA → 暗くて識別困難)
  double: '#FFB74D', // 二塁打 - 明るいアンバー (旧: #F57C00)
  single: '#64B5F6', // 単打   - 明るい水色   (旧: #1E88E5)
  out:    '#9E9E9E', // 凡打   - 明るいグレー  (旧: #757575 → 暗くて識別困難)
} as const

// ────────────────────────────────────────────────
// P-3 / P-9: 方向別ゲージカラー（SPRAY_COLORS と色味を統一）
// ────────────────────────────────────────────────
const GAUGE_COLORS: Record<string, string> = {
  left:         '#64B5F6', // 明るい青
  left_center:  '#66BB6A', // 明るい緑
  center:       '#FFB74D', // 明るいアンバー
  right_center: '#66BB6A',
  right:        '#64B5F6',
  infield:      '#9E9E9E', // 明るいグレー
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
// P-6: left/right を 6° 内側にシフトしてフェアゾーン（±42°）内に収容
// ────────────────────────────────────────────────
const DIRECTION_ANGLE_DEG: Record<string, number> = {
  left:         -36,  // P-6: -42→-36（フェアゾーン内に収容）
  left_center:  -21,
  center:         0,
  right_center:  21,
  right:          36,  // P-6: +42→+36（フェアゾーン内に収容）
  third_base:   -33,  // P-6: -37→-33（扇形展開後も -39° で収容）
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

// ────────────────────────────────────────────────
// P-7: 方向 + 結果から飛距離を決定
//   内野安打（hit + 内野方向）は groundout 相当の短い距離で描画し
//   外野安打との視覚的区別を行う（DB変更なし）
// ────────────────────────────────────────────────
const INFIELD_HIT_DISTANCE_PX = 95  // 内野安打の表示距離（内野手付近）

function getDistance(dir: string, rt: ResultType): number | undefined {
  if (rt === 'hit' && INFIELD_DIRS.has(dir)) return INFIELD_HIT_DISTANCE_PX
  return RESULT_DISTANCE_PX[rt]
}

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
// P-6: フェアゾーン（±42°）クランプ
// P-7: getDistance() により内野安打は短い距離で描画
function calcEndpoint(dir: string, rt: ResultType, offsetDeg = 0): { x: number; y: number } | null {
  const angleDeg = DIRECTION_ANGLE_DEG[dir]
  const dist     = getDistance(dir, rt)
  if (angleDeg === undefined || !dist) return null
  const clamped = Math.max(-42, Math.min(42, angleDeg + offsetDeg))
  const rad = (clamped * Math.PI) / 180
  return { x: HX + dist * Math.sin(rad), y: HY - dist * Math.cos(rad) }
}

// ────────────────────────────────────────────────
// P-5: ドット専用終点計算（ファウルライン回避オフセット）
// P-7: getDistance() により内野安打のドットは内野付近に配置
// ────────────────────────────────────────────────
const DOT_ANGLE_OFFSET: Partial<Record<string, number>> = {
  left:  6,
  right: -6,
}

function calcDotEndpoint(dir: string, rt: ResultType): { x: number; y: number } | null {
  const angleDeg = DIRECTION_ANGLE_DEG[dir]
  const dist     = getDistance(dir, rt)
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

  // P-9: テーマ連動フィールド色（lightテーマのみライトモード扱い）
  const { theme } = useTheme()
  const isDark = theme !== 'light'
  const FIELD_GRASS = isDark ? '#2D5A3D' : '#4a7c59'
  const FIELD_SOIL  = isDark ? '#7A6040' : '#c8a87a'
  const FIELD_MOUND = isDark ? '#6B5535' : '#b8986a'

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

  // P-12: 動的 max（差を強調するため ×1.1）
  const maxDirCount  = Math.max(...Object.values(dirCounts), 1) * 1.1
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

      {/* 結果フィルター */}
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

      {/* P-8: 凡例（チャート外・横並び・スクロール可）打球線と重ならない位置に配置 */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-0.5">
        {([
          { label: '本塁打', subLabel: null,              color: SPRAY_COLORS.hr     },
          { label: '三塁打', subLabel: null,              color: SPRAY_COLORS.triple },
          { label: '二塁打', subLabel: null,              color: SPRAY_COLORS.double },
          { label: '単打',   subLabel: '長=外野/短=内野', color: SPRAY_COLORS.single },
          { label: '凡打',   subLabel: null,              color: SPRAY_COLORS.out    },
        ] as { label: string; subLabel: string | null; color: string }[]).map(({ label, subLabel, color }) => (
          <div key={label} className="flex items-center gap-1.5 shrink-0">
            <svg width="16" height="4" aria-hidden="true" className="shrink-0">
              <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div>
              <span className="text-[11px] text-sub2 leading-none">{label}</span>
              {subLabel && (
                <span className="text-[9px] text-sub2/60 block leading-none mt-0.5">{subLabel}</span>
              )}
            </div>
          </div>
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
          {/* P-9: テーマ連動フィールド色 */}
          <path d={fieldOutline} fill={FIELD_GRASS} />
          <path d={infieldDiamond} fill={FIELD_SOIL} />
          <line x1={HX} y1={HY} x2={f(LF.x)} y2={f(LF.y)} stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1={HX} y1={HY} x2={f(RF.x)} y2={f(RF.y)} stroke="white" strokeWidth="1.5" strokeOpacity="0.7" />
          <path d={fenceArc} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
          <circle cx={f(BASES.pitcher.x)} cy={f(BASES.pitcher.y)} r="10" fill={FIELD_MOUND} />
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

          {/* P-9b: 2パス描画（輪郭→本体）でフィールド上の視認性を向上 */}

          {/* ラインモード パス1: 輪郭（暗色・太め） */}
          {viewMode === 'line' && plottableWithOffset.map(ab => {
            if (!ab.direction) return null
            const ep = calcEndpoint(ab.direction, ab.result_type, ab.offsetDeg)
            if (!ep) return null
            return (
              <line
                key={`outline-${ab.id}`}
                x1={HX} y1={HY}
                x2={f(ep.x)} y2={f(ep.y)}
                stroke="rgba(0,0,0,0.35)"
                strokeWidth="5.5"
                strokeOpacity="1"
                strokeLinecap="round"
              />
            )
          })}

          {/* ラインモード パス2: 本体色 */}
          {viewMode === 'line' && plottableWithOffset.map(ab => {
            if (!ab.direction) return null
            const color = getSprayColor(ab.result_type)
            if (!color) return null
            const ep = calcEndpoint(ab.direction, ab.result_type, ab.offsetDeg)
            if (!ep) return null
            return (
              <line
                key={`line-${ab.id}`}
                x1={HX} y1={HY}
                x2={f(ep.x)} y2={f(ep.y)}
                stroke={color}
                strokeWidth="3.5"
                strokeOpacity="0.85"
                strokeLinecap="round"
              />
            )
          })}

          {/* ドットモード（P-4: 大きなドット・高コントラスト、P-5: ファウルライン回避） */}
          {viewMode === 'dot' && plottableWithOffset.map(ab => {
            if (!ab.direction) return null
            const color = getSprayColor(ab.result_type)
            if (!color) return null
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
        {/* P-8: 凡例はチャート外に移動済み（絶対配置オーバーレイなし） */}
      </div>

      {/* P-11: サマリー 3行階層化（打率を先頭に昇格） */}
      <div className="space-y-0.5 px-1">
        {/* 1行目: 最重要指標（打席数・打率） */}
        <p className="text-sm text-sub2">
          <span className="text-main font-semibold">{summary.total}</span>
          <span className="text-sub2"> 打席　／　打率 </span>
          <span className="text-main font-bold text-base">{summary.avgStr}</span>
        </p>
        {/* 2行目: 安打内訳（カテゴリ別色付き） */}
        <p className="text-xs text-sub2">
          安打 <span className="font-semibold text-main">{summary.hits}</span>（
          <span className="font-semibold" style={{ color: SPRAY_COLORS.hr }}>本{summary.hrs}</span>・
          <span className="font-semibold" style={{ color: SPRAY_COLORS.triple }}>三{summary.triples}</span>・
          <span className="font-semibold" style={{ color: SPRAY_COLORS.double }}>二{summary.doubles}</span>・
          <span className="font-semibold" style={{ color: SPRAY_COLORS.single }}>単{summary.singles}</span>）
        </p>
        {/* 3行目: 凡打 */}
        <p className="text-xs text-sub2/70">
          凡打 <span className="font-semibold">{summary.outs}</span>
          <span className="ml-2 text-[10px]">（打数 {summary.abCount}）</span>
        </p>
      </div>

      {/* P-3 / P-12: 方向別ゲージバーグラフ（外野・内野を区切り線で分離） */}
      <div className="bg-lv2 rounded-xl p-3 space-y-2">
        <p className="text-[10px] text-sub2 font-medium">方向別打球数</p>

        {/* 外野5方向 */}
        {([
          { key: 'left',         label: '左'   },
          { key: 'left_center',  label: '左中' },
          { key: 'center',       label: '中'   },
          { key: 'right_center', label: '右中' },
          { key: 'right',        label: '右'   },
        ] as const).map(({ key, label }) => {
          const count = dirCounts[key] ?? 0
          const pct   = (count / maxDirCount) * 100
          const color = GAUGE_COLORS[key]
          return (
            <div key={key} className="flex items-center gap-2">
              {/* P-12: ラベル幅 w-6→w-8（「左中」「右中」を収容） */}
              <span className="text-[10px] text-sub2 w-8 text-right shrink-0">{label}</span>
              {/* P-12: バー高さ h-3.5→h-4 */}
              <div className="relative flex-1 h-4 bg-lv1 rounded-full overflow-hidden border border-s2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }}
                />
                {[25, 50, 75].map(tick => (
                  <div
                    key={tick}
                    className="absolute inset-y-0 w-px bg-s2/60"
                    style={{ left: `${tick}%` }}
                  />
                ))}
              </div>
              {/* P-12: 数値幅 w-4→w-6、text-xs font-semibold */}
              <span className="text-xs font-semibold text-main w-6 shrink-0 text-right">{count}</span>
            </div>
          )
        })}

        {/* P-12: 外野・内野グループ区切り線 */}
        <hr className="border-s2/50" />

        {/* 内野（外野と性質が異なるため区切り線で分離） */}
        {(() => {
          const count = dirCounts['infield'] ?? 0
          const pct   = (count / maxDirCount) * 100
          return (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-sub2 w-8 text-right shrink-0">内野</span>
              <div className="relative flex-1 h-4 bg-lv1 rounded-full overflow-hidden border border-s2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: GAUGE_COLORS['infield'], opacity: 0.75 }}
                />
                {[25, 50, 75].map(tick => (
                  <div
                    key={tick}
                    className="absolute inset-y-0 w-px bg-s2/60"
                    style={{ left: `${tick}%` }}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-main w-6 shrink-0 text-right">{count}</span>
            </div>
          )
        })()}
      </div>

    </div>
  )
}
