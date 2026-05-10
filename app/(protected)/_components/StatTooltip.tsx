'use client'

import { useState, useRef, useEffect } from 'react'
import { STAT_TOOLTIPS } from '@/app/lib/statTooltips'

export default function StatTooltip({ label }: { label: string }) {
  const [show, setShow] = useState(false)
  const [isTouch, setIsTouch] = useState(false)
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tip = STAT_TOOLTIPS[label]

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouch(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const handleMouseEnter = () => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const TIP_W = 256   // w-64
    const GAP = 8
    const rawLeft = rect.left + rect.width / 2 - TIP_W / 2
    const left = Math.max(GAP, Math.min(rawLeft, window.innerWidth - TIP_W - GAP))
    const top = rect.top - GAP  // -translateY(100%) で上に出る
    setTipPos({ top, left })
    setShow(true)
  }

  if (!tip) return <>{label}</>

  return (
    <span className="relative inline-flex items-center gap-1">
      {label}
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={isTouch ? undefined : handleMouseEnter}
        onMouseLeave={isTouch ? undefined : () => setShow(false)}
        onClick={isTouch ? () => setShow(v => !v) : undefined}
        className="text-sub2 hover:text-theme transition-colors text-xs leading-none"
        aria-label={`${label}の説明`}
      >
        ⓘ
      </button>
      {/* デスクトップ: fixed位置ツールチップ（viewport クランプ済み） */}
      {!isTouch && show && tipPos && (
        <span
          className="fixed z-50 bg-lv1 border border-s2 text-sub1 text-xs rounded-lg shadow-lg p-2.5 w-64 pointer-events-none block font-normal"
          style={{ top: tipPos.top, left: tipPos.left, transform: 'translateY(calc(-100% - 8px))' }}
        >
          {tip}
        </span>
      )}
      {/* スマホ: 画面下部モーダルシート */}
      {isTouch && show && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShow(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 bg-lv1 border-t border-s2 rounded-t-2xl p-6 shadow-2xl">
            <div className="text-sm font-bold text-accent mb-2">{label}</div>
            <p className="text-sm text-sub1 leading-relaxed">{tip}</p>
          </div>
        </>
      )}
    </span>
  )
}
