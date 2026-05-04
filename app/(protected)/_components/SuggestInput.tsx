'use client'

import { useState } from 'react'

const INPUT = 'w-full border border-gray-200 dark:border-night-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-night-750 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-night-400 focus:outline-none focus:ring-2 focus:ring-crimson-500 dark:focus:ring-crimson-400'

interface SuggestInputProps {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
  className?: string
  title?: string
}

/**
 * テキスト入力 + 履歴選択ボタン
 * - フリー入力はそのまま
 * - ボタンを押すとフルスクリーンの選択シートが開く
 * - シート内はスクロールして選択（スクロール中の誤タップなし）
 */
export default function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  className,
  title,
}: SuggestInputProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSelect = (s: string) => {
    onChange(s)
    setSheetOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`flex-1 min-w-0 ${className ?? INPUT}`}
          autoComplete="off"
        />
        {suggestions.length > 0 && (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="履歴から選択"
            className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-crimson-500 dark:border-crimson-400 text-crimson-500 dark:text-crimson-400 flex items-center justify-center hover:bg-crimson-50 dark:hover:bg-crimson-900/20 active:bg-crimson-100 dark:active:bg-crimson-900/40 transition-colors"
          >
            {/* list icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <circle cx="3" cy="6" r="0.5" fill="currentColor" />
              <circle cx="3" cy="12" r="0.5" fill="currentColor" />
              <circle cx="3" cy="18" r="0.5" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>

      {/* フルスクリーン選択シート */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-night-900 flex flex-col">
          {/* ヘッダー */}
          <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-night-600 bg-white dark:bg-night-800">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="text-crimson-500 dark:text-crimson-400 text-sm font-medium"
            >
              ← 戻る
            </button>
            {title && (
              <h2 className="flex-1 text-center text-base font-semibold text-gray-800 dark:text-white pr-12">
                {title}
              </h2>
            )}
          </div>

          {/* 候補リスト */}
          <div className="flex-1 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSelect(s)}
                className={`w-full text-left px-5 py-4 text-base border-b border-gray-100 dark:border-night-700 transition-colors ${
                  value === s
                    ? 'text-crimson-600 dark:text-crimson-400 font-medium bg-crimson-50 dark:bg-crimson-900/20'
                    : 'text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-night-800 active:bg-gray-100 dark:active:bg-night-700'
                }`}
              >
                <span className="flex items-center justify-between">
                  {s}
                  {value === s && (
                    <span className="text-crimson-500 dark:text-crimson-400 text-lg leading-none">✓</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
