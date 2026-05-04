'use client'

import { useState, useRef, useEffect } from 'react'

const INPUT = 'w-full border border-gray-200 dark:border-night-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-night-750 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-night-400 focus:outline-none focus:ring-2 focus:ring-crimson-500 dark:focus:ring-crimson-400'

interface SuggestInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
  className?: string
}

/**
 * テキスト入力 + 過去入力候補のドロップダウン
 * - フォーカス時に全候補を表示
 * - 入力中は部分一致でフィルタ
 * - 候補タップで入力欄に反映、フリー入力も可能
 */
export default function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  className,
}: SuggestInputProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 外側クリック/タップでドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  const visibleSuggestions = suggestions.filter((s) => {
    const q = value.trim().toLowerCase()
    if (!q) return true              // 未入力 → 全件表示
    return s.toLowerCase().includes(q) && s !== value  // 部分一致かつ完全一致は非表示
  })

  const handleSelect = (s: string) => {
    onChange(s)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          if (suggestions.length > 0) setOpen(true)
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true)
        }}
        placeholder={placeholder}
        required={required}
        className={className ?? INPUT}
        autoComplete="off"
      />

      {open && visibleSuggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-night-800 border border-gray-200 dark:border-night-600 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {visibleSuggestions.map((s) => (
            <li key={s} className="border-b border-gray-100 dark:border-night-700 last:border-b-0">
              <button
                type="button"
                // mousedown/touchend で input blur より先に選択を確定させる
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
                onTouchEnd={(e) => { e.preventDefault(); handleSelect(s) }}
                className="w-full text-left px-4 py-3 text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-night-750 active:bg-gray-100 dark:active:bg-night-700 transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
