'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { AtBat } from '@/lib/supabase/types'

interface GameForCalendar {
  id: string
  game_date: string
  opponent: string
  result: 'win' | 'loss' | 'draw'
  score_us: number
  score_them: number
  at_bats: AtBat[]
}

interface Props {
  games: GameForCalendar[]
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun
}

export default function GamesCalendar({ games }: Props) {
  // 表示対象の月を求める（最新試合の年月、なければ今月）
  const today = new Date()
  const latestDate = games.length > 0
    ? new Date(games[0].game_date)
    : today
  const [year, setYear] = useState(latestDate.getFullYear())
  const [month, setMonth] = useState(latestDate.getMonth()) // 0-indexed

  // ゲームを日付でインデックス化
  const gameByDate = new Map<string, GameForCalendar[]>()
  for (const g of games) {
    const key = g.game_date // 'YYYY-MM-DD'
    if (!gameByDate.has(key)) gameByDate.set(key, [])
    gameByDate.get(key)!.push(g)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const monthLabel = `${year}年${month + 1}月`
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="bg-lv1 rounded-xl border border-s2 overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-s2">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-lv2 text-sub1 transition-colors">
          ←
        </button>
        <span className="font-semibold text-main">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-lv2 text-sub1 transition-colors">
          →
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 border-b border-s2">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`text-center py-2 text-xs font-medium ${
            i === 0 ? 'text-neg-t' : i === 6 ? 'text-theme' : 'text-sub2'
          }`}>{w}</div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="grid grid-cols-7">
        {/* 空白セル */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[56px] border-b border-r border-s2 last:border-r-0" />
        ))}
        {/* 日付セル */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const dayGames = gameByDate.get(dateStr) ?? []
          const colIndex = (firstDay + i) % 7
          const isToday = dateStr === today.toISOString().split('T')[0]

          return (
            <div
              key={dateStr}
              className={`min-h-[56px] border-b border-r border-s2 p-1 ${
                (firstDay + i + 1) % 7 === 0 ? 'border-r-0' : ''
              }`}
            >
              <div className={`text-xs mb-1 w-5 h-5 flex items-center justify-center rounded-full mx-auto ${
                isToday
                  ? 'bg-theme text-white font-bold'
                  : colIndex === 0
                  ? 'text-neg-t'
                  : colIndex === 6
                  ? 'text-theme'
                  : 'text-sub1'
              }`}>
                {day}
              </div>
              {dayGames.map(g => {
                const mark = g.result === 'win' ? '○' : g.result === 'loss' ? '●' : '△'
                const markClass = g.result === 'win' ? 'text-pos-t' : g.result === 'loss' ? 'text-neg-t' : 'text-neu-t'
                return (
                  <Link
                    key={g.id}
                    href={`/games/${g.id}`}
                    className="block text-[10px] leading-tight px-0.5 py-0.5 rounded hover:bg-lv2 transition-colors"
                  >
                    <span className={`font-bold ${markClass}`}>{mark}</span>
                    <span className="text-sub2 ml-0.5 truncate">{g.score_us}-{g.score_them}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
