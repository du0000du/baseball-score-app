'use client'

import { useState } from 'react'

const INPUT = 'w-full border border-s2 rounded-lg px-3 py-2 text-sm bg-lv1 text-main placeholder-sub2 focus:outline-none focus:ring-2 focus:ring-theme'

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
            className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-theme text-accent flex items-center justify-center hover:bg-theme/10 active:bg-theme/15 transition-colors"
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
        <div className="fixed inset-0 z-[100] bg-lv1 flex flex-col">
          {/* ヘッダー */}
          <div className="flex items-center px-4 py-3 border-b border-s2 bg-lv1">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="text-accent text-sm font-medium"
            >
              ← 戻る
            </button>
            {title && (
              <h2 className="flex-1 text-center text-base font-semibold text-main pr-12">
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
                className={`w-full text-left px-5 py-4 text-base border-b border-s2 transition-colors ${
                  value === s
                    ? 'text-accent font-medium bg-theme/10 dark:bg-theme/10'
                    : 'text-main hover:bg-lv2 dark:hover:bg-lv1 active:bg-lv2'
                }`}
              >
                <span className="flex items-center justify-between">
                  {s}
                  {value === s && (
                    <span className="text-accent text-lg leading-none">✓</span>
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
