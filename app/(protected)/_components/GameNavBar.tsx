'use client'

import Link from 'next/link'

export interface NavGame {
  id: string
  game_date: string
  opponent: string
}

interface Props {
  prevGame: NavGame | null
  nextGame: NavGame | null
}

function fmtNavDate(dateStr: string) {
  // "2026-05-10" → "5/10"
  const parts = dateStr.split('-')
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`
}

export default function GameNavBar({ prevGame, nextGame }: Props) {
  return (
    <div className="flex items-center justify-between border-b border-s2 pb-2 mb-1">
      {prevGame ? (
        <Link
          href={`/games/${prevGame.id}`}
          className="flex items-center gap-1 text-sub1 hover:text-theme transition-colors min-w-0"
        >
          <span className="shrink-0 text-base leading-none">‹</span>
          <span className="hidden sm:inline text-xs text-sub2 truncate max-w-[140px]">
            {fmtNavDate(prevGame.game_date)} {prevGame.opponent}
          </span>
          <span className="sm:hidden text-xs">前の試合</span>
        </Link>
      ) : (
        <span className="text-sub2 text-xs">— 最初の試合</span>
      )}

      {nextGame ? (
        <Link
          href={`/games/${nextGame.id}`}
          className="flex items-center gap-1 text-sub1 hover:text-theme transition-colors min-w-0 text-right"
        >
          <span className="hidden sm:inline text-xs text-sub2 truncate max-w-[140px]">
            {fmtNavDate(nextGame.game_date)} {nextGame.opponent}
          </span>
          <span className="sm:hidden text-xs">次の試合</span>
          <span className="shrink-0 text-base leading-none">›</span>
        </Link>
      ) : (
        <span className="text-sub2 text-xs">最新の試合 —</span>
      )}
    </div>
  )
}
