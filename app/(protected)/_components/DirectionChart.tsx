'use client'

import { memo, useState } from 'react'
import type { AtBat, OutfieldDirection, InfieldPosition } from '@/lib/supabase/types'

const OUTFIELD_ORDER: OutfieldDirection[] = ['left', 'left_center', 'center', 'right_center', 'right']
const OUTFIELD_SHORT: Record<OutfieldDirection, string> = {
  left: 'レフト',
  left_center: '左中',
  center: 'センター',
  right_center: '右中',
  right: 'ライト',
}

const INFIELD_ORDER: InfieldPosition[] = ['pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop']
const INFIELD_SHORT: Record<InfieldPosition, string> = {
  pitcher: '投', catcher: '捕', first_base: '一', second_base: '二', third_base: '三', shortstop: '遊',
}
const INFIELD_FULL: Record<InfieldPosition, string> = {
  pitcher: '投手', catcher: '捕手', first_base: '一塁', second_base: '二塁', third_base: '三塁', shortstop: '遊撃',
}

const OUTFIELD_KEYS = new Set<string>(['left', 'left_center', 'center', 'right_center', 'right'])
const INFIELD_KEYS = new Set<string>(['pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop'])

const HIT_TYPES = new Set(['hit', 'double', 'triple', 'hr'])
const OUT_TYPES = new Set(['strikeout', 'groundout', 'outfield_groundout', 'flyout', 'infield_flyout', 'liner_out', 'foul_flyout'])

type Mode = 'all' | 'hit' | 'out'

function heatColor(pct: number): { fill: string; text: string } {
  if (pct === 0) return { fill: '#f3f4f6', text: '#9ca3af' }
  if (pct < 12)  return { fill: '#dbeafe', text: '#1e40af' }
  if (pct < 22)  return { fill: '#60a5fa', text: '#1e3a8a' }
  if (pct < 32)  return { fill: '#2563eb', text: 'white'   }
  if (pct < 45)  return { fill: '#f97316', text: 'white'   }
  return              { fill: '#dc2626', text: 'white'   }
}

function heatColorHit(pct: number): { fill: string; text: string } {
  if (pct === 0) return { fill: '#f0fdf4', text: '#9ca3af' }
  if (pct < 12)  return { fill: '#bbf7d0', text: '#166534' }
  if (pct < 22)  return { fill: '#4ade80', text: '#14532d' }
  if (pct < 32)  return { fill: '#16a34a', text: 'white'   }
  if (pct < 45)  return { fill: '#15803d', text: 'white'   }
  return              { fill: '#14532d', text: 'white'   }
}

function heatColorOut(pct: number): { fill: string; text: string } {
  if (pct === 0) return { fill: '#fef2f2', text: '#9ca3af' }
  if (pct < 12)  return { fill: '#fecaca', text: '#991b1b' }
  if (pct < 22)  return { fill: '#f87171', text: '#7f1d1d' }
  if (pct < 32)  return { fill: '#dc2626', text: 'white'   }
  if (pct < 45)  return { fill: '#b91c1c', text: 'white'   }
  return              { fill: '#7f1d1d', text: 'white'   }
}

function getColor(mode: Mode, pct: number) {
  if (mode === 'hit') return heatColorHit(pct)
  if (mode === 'out') return heatColorOut(pct)
  return heatColor(pct)
}

function toRad(deg: number) { return (deg * Math.PI) / 180 }

function arcPath(cx: number, cy: number, r: number, s: number, e: number): string {
  const x1 = (cx + r * Math.cos(toRad(s))).toFixed(2)
  const y1 = (cy + r * Math.sin(toRad(s))).toFixed(2)
  const x2 = (cx + r * Math.cos(toRad(e))).toFixed(2)
  const y2 = (cy + r * Math.sin(toRad(e))).toFixed(2)
  const large = e - s > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

function midPt(cx: number, cy: number, r: number, s: number, e: number) {
  const m = (s + e) / 2
  return { x: cx + r * Math.cos(toRad(m)), y: cy + r * Math.sin(toRad(m)) }
}

interface Props { atBats: AtBat[] }

const MODE_TABS: { value: Mode; label: string }[] = [
  { value: 'all',  label: '全打球' },
  { value: 'hit',  label: '安打のみ' },
  { value: 'out',  label: 'アウトのみ' },
]

function DirectionChart({ atBats }: Props) {
  const [mode, setMode] = useState<Mode>('all')

  // モードでフィルタリング
  const filtered = atBats.filter(ab => {
    if (mode === 'hit') return HIT_TYPES.has(ab.result_type)
    if (mode === 'out') return OUT_TYPES.has(ab.result_type)
    return true
  })

  const ofCnt = Object.fromEntries(OUTFIELD_ORDER.map(k => [k, 0])) as Record<OutfieldDirection, number>
  const ifCnt = Object.fromEntries(INFIELD_ORDER.map(k => [k, 0])) as Record<InfieldPosition, number>
  let ofTotal = 0, ifTotal = 0

  for (const ab of filtered) {
    if (!ab.direction) continue
    if (OUTFIELD_KEYS.has(ab.direction)) { ofCnt[ab.direction as OutfieldDirection]++; ofTotal++ }
    else if (INFIELD_KEYS.has(ab.direction)) { ifCnt[ab.direction as InfieldPosition]++; ifTotal++ }
  }

  const ofPct = (d: OutfieldDirection) => ofTotal > 0 ? (ofCnt[d] / ofTotal) * 100 : 0
  const ifPct = (d: InfieldPosition)   => ifTotal > 0 ? (ifCnt[d] / ifTotal) * 100 : 0

  // Fan: home plate at bottom center, sectors open upward (angles 180°→360° clockwise)
  const CX = 200, CY = 228, R = 172
  const sectors = OUTFIELD_ORDER.map((dir, i) => ({
    dir, start: 180 + i * 36, end: 180 + (i + 1) * 36,
  }))

  // Infield field positions (SVG coords, viewBox 300x285)
  const positions: { pos: InfieldPosition; x: number; y: number }[] = [
    { pos: 'catcher',     x: 150, y: 248 },
    { pos: 'pitcher',     x: 150, y: 158 },
    { pos: 'first_base',  x: 218, y: 150 },
    { pos: 'second_base', x: 173, y: 91  },
    { pos: 'third_base',  x: 82,  y: 150 },
    { pos: 'shortstop',   x: 127, y: 91  },
  ]

  const noDataMsg =
    mode === 'hit' ? '安打方向のデータがありません' :
    mode === 'out' ? 'アウト方向のデータがありません' :
    'データがありません'

  return (
    <div className="space-y-5">
      {/* ─── モード切り替えトグル ─── */}
      <div className="flex gap-1.5">
        {MODE_TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setMode(value)
              ;(e.currentTarget as HTMLButtonElement).blur()
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              mode === value
                ? 'bg-theme text-white border-theme'
                : 'bg-lv2 border-s2 text-sub2 hover:text-main'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-sub2 self-center">{filtered.length} 打球</span>
      </div>

      {/* ───── 外野 ───── */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-5 min-h-[260px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-sub1 uppercase tracking-wide">外野方向</h3>
          <span className="text-xs text-sub2">{ofTotal} 打球</span>
        </div>

        {ofTotal === 0 ? (
          <p className="text-center text-sub2 text-sm py-10">{noDataMsg}</p>
        ) : (
          <>
            <svg viewBox="0 0 400 240" className="w-full" role="img" aria-label="外野打球方向チャート">
              {/* green field bg */}
              <path
                d={`M ${CX} ${CY} L ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`}
                fill="#f0fdf4"
              />
              {/* sectors */}
              {sectors.map(({ dir, start, end }) => (
                <path
                  key={dir}
                  d={arcPath(CX, CY, R, start, end)}
                  fill={getColor(mode, ofPct(dir)).fill}
                  fillOpacity="0.85"
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
              {/* pct + label */}
              {sectors.map(({ dir, start, end }) => {
                const pct = ofPct(dir)
                const { text } = getColor(mode, pct)
                const { x, y } = midPt(CX, CY, R * 0.61, start, end)
                return (
                  <g key={dir}>
                    <text x={x} y={y - 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={text}>
                      {pct.toFixed(0)}%
                    </text>
                    <text x={x} y={y + 9} textAnchor="middle" fontSize="9.5" fill={text} opacity="0.9">
                      {OUTFIELD_SHORT[dir]}
                    </text>
                  </g>
                )
              })}
              {/* home plate dot */}
              <circle cx={CX} cy={CY} r="5" fill="#374151" />
            </svg>

            {/* legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
              {OUTFIELD_ORDER.map(dir => (
                <div key={dir} className="flex items-center gap-1 text-xs text-sub2">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: getColor(mode, ofPct(dir)).fill, border: '1px solid #e5e7eb' }} />
                  {OUTFIELD_SHORT[dir]}&nbsp;({ofCnt[dir]})
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ───── 内野 ───── */}
      <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-5 min-h-[330px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-sub1 uppercase tracking-wide">内野方向</h3>
          <span className="text-xs text-sub2">{ifTotal} 打球</span>
        </div>

        {ifTotal === 0 ? (
          <p className="text-center text-sub2 text-sm py-10">{noDataMsg}</p>
        ) : (
          <>
            <svg viewBox="0 0 300 285" className="w-full max-w-xs mx-auto" role="img" aria-label="内野打球方向チャート">
              {/* infield diamond */}
              <polygon
                points="150,62 232,148 150,234 68,148"
                fill="#f0fdf4"
                stroke="#d1fae5"
                strokeWidth="1.5"
              />
              {/* pitcher mound */}
              <circle cx="150" cy="155" r="26"
                fill="none" stroke="#d1fae5" strokeWidth="1" strokeDasharray="3,3" />
              {/* positions */}
              {positions.map(({ pos, x, y }) => {
                const pct = ifPct(pos)
                const { fill, text } = getColor(mode, pct)
                return (
                  <g key={pos}>
                    <circle cx={x} cy={y} r="22" fill={fill} fillOpacity="0.88"
                      stroke="white" strokeWidth="1.5" />
                    <text x={x} y={y - 2} textAnchor="middle" fontSize="9" fontWeight="700" fill={text}>
                      {pct.toFixed(0)}%
                    </text>
                    <text x={x} y={y + 9} textAnchor="middle" fontSize="8.5" fill={text}>
                      {INFIELD_SHORT[pos]}
                    </text>
                  </g>
                )
              })}
              {/* base labels */}
              <text x="247" y="153" fontSize="8" fill="#9ca3af">一塁</text>
              <text x="150" y="251" textAnchor="middle" fontSize="8" fill="#9ca3af">本塁</text>
              <text x="150" y="51"  textAnchor="middle" fontSize="8" fill="#9ca3af">二塁</text>
              <text x="53"  y="153" textAnchor="end"    fontSize="8" fill="#9ca3af">三塁</text>
            </svg>

            {/* legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
              {INFIELD_ORDER.map(pos => (
                <div key={pos} className="flex items-center gap-1 text-xs text-sub2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: getColor(mode, ifPct(pos)).fill, border: '1px solid #e5e7eb' }} />
                  {INFIELD_FULL[pos]}&nbsp;({ifCnt[pos]})
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default memo(DirectionChart)
