'use client'

import { useEffect, useState } from 'react'

interface Props {
  currentAvg: number | null
}

export default function DashboardTargetMeter({ currentAvg }: Props) {
  const [targetAvg, setTargetAvg] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('baseball_target_avg')
    if (stored) {
      const parsed = parseFloat(stored)
      if (!isNaN(parsed) && parsed > 0) setTargetAvg(parsed)
    }
  }, [])

  if (targetAvg === null || currentAvg === null) return null

  const pct = Math.min(100, Math.round((currentAvg / targetAvg) * 100))
  const reached = currentAvg >= targetAvg
  const barColor = reached ? 'bg-pos-t' : pct >= 80 ? 'bg-neu-t' : 'bg-theme'
  const fmtAvg = (v: number) => v.toFixed(3).replace(/^0/, '')

  return (
    <div className="bg-lv1 rounded-xl shadow-sm border border-s2 p-5 mt-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-sub1 uppercase tracking-wide">目標打率達成度</h2>
        <span className="text-xs text-sub2">目標: {fmtAvg(targetAvg)}</span>
      </div>
      <div className="flex items-center gap-3 mb-1">
        <div className="flex-1 bg-lv2 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`text-sm font-bold tabular-nums ${reached ? 'text-pos-t' : 'text-main'}`}>
          {pct}%
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-sub2">
        <span>現在: <span className="font-semibold text-main">{fmtAvg(currentAvg)}</span></span>
        {reached ? (
          <span className="text-pos-t font-semibold">🎯 目標達成！</span>
        ) : (
          <span>あと <span className="font-semibold text-main">{fmtAvg(targetAvg - currentAvg)}</span></span>
        )}
      </div>
    </div>
  )
}
