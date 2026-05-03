'use client'

import { useContext } from 'react'
import { ThemeContext } from './ThemeProvider'
import type { AtBat, OutfieldDirection, InfieldPosition } from '@/lib/supabase/types'

const OUTFIELD_ORDER: OutfieldDirection[] = ['left', 'left_center', 'center', 'right_center', 'right']
const OUTFIELD_SHORT: Record<OutfieldDirection, string> = {
  left: 'レフト', left_center: '左中', center: 'センター', right_center: '右中', right: 'ライト',
}
const INFIELD_ORDER: InfieldPosition[] = ['pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop']
const INFIELD_SHORT: Record<InfieldPosition, string> = {
  pitcher: '投', catcher: '捕', first_base: '一', second_base: '二', third_base: '三', shortstop: '遊',
}
const INFIELD_FULL: Record<InfieldPosition, string> = {
  pitcher: '投手', catcher: '捕手', first_base: '一塁', second_base: '二塁', third_base: '三塁', shortstop: '遊撃',
}
const OUTFIELD_KEYS = new Set<string>(['left', 'left_center', 'center', 'right_center', 'right'])
const INFIELD_KEYS  = new Set<string>(['pitcher', 'catcher', 'first_base', 'second_base', 'third_base', 'shortstop'])

function heatColor(pct: number, dark: boolean): { fill: string; text: string } {
  if (dark) {
    if (pct === 0) return { fill: '#2c2020', text: '#a08888' }
    if (pct < 12)  return { fill: '#172554', text: '#93c5fd' }
    if (pct < 22)  return { fill: '#1e40af', text: '#bfdbfe' }
    if (pct < 32)  return { fill: '#1d4ed8', text: 'white'  }
    if (pct < 45)  return { fill: '#9a3412', text: '#fdba74' }
    return              { fill: '#b91c1c', text: 'white'  }
  }
  if (pct === 0) return { fill: '#f3f4f6', text: '#9ca3af' }
  if (pct < 12)  return { fill: '#dbeafe', text: '#1e40af' }
  if (pct < 22)  return { fill: '#60a5fa', text: '#1e3a8a' }
  if (pct < 32)  return { fill: '#2563eb', text: 'white'  }
  if (pct < 45)  return { fill: '#f97316', text: 'white'  }
  return              { fill: '#dc2626', text: 'white'  }
}

function toRad(deg: number) { return (deg * Math.PI) / 180 }

function arcPath(cx: number, cy: number, r: number, s: number, e: number): string {
  const x1 = (cx + r * Math.cos(toRad(s))).toFixed(2)
  const y1 = (cy + r * Math.sin(toRad(s))).toFixed(2)
  const x2 = (cx + r * Math.cos(toRad(e))).toFixed(2)
  const y2 = (cy + r * Math.sin(toRad(e))).toFixed(2)
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${x2} ${y2} Z`
}

function midPt(cx: number, cy: number, r: number, s: number, e: number) {
  const m = (s + e) / 2
  return { x: cx + r * Math.cos(toRad(m)), y: cy + r * Math.sin(toRad(m)) }
}

interface Props { atBars?: never; atBats: AtBat[] }

export default function DirectionChart({ atBats }: { atBats: AtBat[] }) {
  const { theme } = useContext(ThemeContext)
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const ofCnt = Object.fromEntries(OUTFIELD_ORDER.map(k => [k, 0])) as Record<OutfieldDirection, number>
  const ifCnt = Object.fromEntries(INFIELD_ORDER.map(k => [k, 0])) as Record<InfieldPosition, number>
  let ofTotal = 0, ifTotal = 0

  for (const ab of atBats) {
    if (!ab.direction) continue
    if (OUTFIELD_KEYS.has(ab.direction)) { ofCnt[ab.direction as OutfieldDirection]++; ofTotal++ }
    else if (INFIELD_KEYS.has(ab.direction)) { ifCnt[ab.direction as InfieldPosition]++; ifTotal++ }
  }

  const ofPct = (d: OutfieldDirection) => ofTotal > 0 ? (ofCnt[d] / ofTotal) * 100 : 0
  const ifPct = (d: InfieldPosition)   => ifTotal > 0 ? (ifCnt[d] / ifTotal) * 100 : 0

  const CX = 200, CY = 228, R = 172
  const sectors = OUTFIELD_ORDER.map((dir, i) => ({
    dir, start: 180 + i * 36, end: 180 + (i + 1) * 36,
  }))

  const positions: { pos: InfieldPosition; x: number; y: number }[] = [
    { pos: 'catcher',     x: 150, y: 248 },
    { pos: 'pitcher',     x: 150, y: 158 },
    { pos: 'first_base',  x: 218, y: 150 },
    { pos: 'second_base', x: 150, y: 77  },
    { pos: 'third_base',  x: 82,  y: 150 },
    { pos: 'shortstop',   x: 107, y: 112 },
  ]

  // 色定義
  const fieldBg      = isDark ? '#0a1a0d' : '#f0fdf4'
  const fieldStroke  = isDark ? '#1a3320' : '#d1fae5'
  const sectorStroke = isDark ? '#1c1414' : 'white'
  const baseLabel    = isDark ? '#a08888' : '#9ca3af'
  const homePlate    = isDark ? '#e0d0d0' : '#374151'
  const cardBg       = isDark ? '#1c1414' : 'white'
  const cardBorder   = isDark ? '#3d2828' : '#f3f4f6'
  const legendText   = isDark ? '#a08888' : '#6b7280'
  const legendBorder = isDark ? '#3d2828' : '#e5e7eb'

  return (
    <div className="space-y-5">
      {/* 外野 */}
      <div className="rounded-xl shadow-sm border p-5" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: legendText }}>外野方向</h3>
          <span className="text-xs" style={{ color: legendText }}>{ofTotal} 打球</span>
        </div>
        {ofTotal === 0 ? (
          <p className="text-center text-sm py-10" style={{ color: legendText }}>外野方向のデータがありません</p>
        ) : (
          <>
            <svg viewBox="0 0 400 240" className="w-full">
              <path
                d={`M ${CX} ${CY} L ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY} Z`}
                fill={fieldBg}
              />
              {sectors.map(({ dir, start, end }) => (
                <path
                  key={dir}
                  d={arcPath(CX, CY, R, start, end)}
                  fill={heatColor(ofPct(dir), isDark).fill}
                  fillOpacity="0.9"
                  stroke={sectorStroke}
                  strokeWidth="2"
                />
              ))}
              {sectors.map(({ dir, start, end }) => {
                const pct = ofPct(dir)
                const { text } = heatColor(pct, isDark)
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
              <circle cx={CX} cy={CY} r="5" fill={homePlate} />
            </svg>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
              {OUTFIELD_ORDER.map(dir => (
                <div key={dir} className="flex items-center gap-1 text-xs" style={{ color: legendText }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-sm"
                    style={{ background: heatColor(ofPct(dir), isDark).fill, border: `1px solid ${legendBorder}` }} />
                  {OUTFIELD_SHORT[dir]}&nbsp;({ofCnt[dir]})
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 内野 */}
      <div className="rounded-xl shadow-sm border p-5" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: legendText }}>内野方向</h3>
          <span className="text-xs" style={{ color: legendText }}>{ifTotal} 打球</span>
        </div>
        {ifTotal === 0 ? (
          <p className="text-center text-sm py-10" style={{ color: legendText }}>内野方向のデータがありません</p>
        ) : (
          <>
            <svg viewBox="0 0 300 285" className="w-full max-w-xs mx-auto">
              <polygon points="150,62 232,148 150,234 68,148" fill={fieldBg} stroke={fieldStroke} strokeWidth="1.5" />
              <circle cx="150" cy="155" r="26" fill="none" stroke={fieldStroke} strokeWidth="1" strokeDasharray="3,3" />
              {positions.map(({ pos, x, y }) => {
                const pct = ifPct(pos)
                const { fill, text } = heatColor(pct, isDark)
                return (
                  <g key={pos}>
                    <circle cx={x} cy={y} r="22" fill={fill} fillOpacity="0.92" stroke={sectorStroke} strokeWidth="1.5" />
                    <text x={x} y={y - 2} textAnchor="middle" fontSize="9" fontWeight="700" fill={text}>
                      {pct.toFixed(0)}%
                    </text>
                    <text x={x} y={y + 9} textAnchor="middle" fontSize="8.5" fill={text}>
                      {INFIELD_SHORT[pos]}
                    </text>
                  </g>
                )
              })}
              <text x="247" y="153" fontSize="8" fill={baseLabel}>一塁</text>
              <text x="150" y="251" textAnchor="middle" fontSize="8" fill={baseLabel}>本塁</text>
              <text x="150" y="51"  textAnchor="middle" fontSize="8" fill={baseLabel}>二塁</text>
              <text x="53"  y="153" textAnchor="end"    fontSize="8" fill={baseLabel}>三塁</text>
            </svg>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
              {INFIELD_ORDER.map(pos => (
                <div key={pos} className="flex items-center gap-1 text-xs" style={{ color: legendText }}>
                  <span className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: heatColor(ifPct(pos), isDark).fill, border: `1px solid ${legendBorder}` }} />
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
