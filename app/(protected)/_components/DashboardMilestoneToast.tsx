'use client'

import { useEffect, useState } from 'react'

interface Props {
  earnedIds: string[]
  badgeLabels: Record<string, string>
}

export default function DashboardMilestoneToast({ earnedIds, badgeLabels }: Props) {
  const [newBadges, setNewBadges] = useState<string[]>([])
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (earnedIds.length === 0) return
    const seen: string[] = JSON.parse(localStorage.getItem('baseball_milestones_seen') ?? '[]')
    const fresh = earnedIds.filter(id => !seen.includes(id))
    if (fresh.length === 0) return

    // 新規達成バッジを localStorage に保存
    const updated = [...seen, ...fresh]
    localStorage.setItem('baseball_milestones_seen', JSON.stringify(updated))
    setNewBadges(fresh)
    setVisible(true)
  }, [])

  // 複数バッジがある場合は順番に表示
  useEffect(() => {
    if (!visible || newBadges.length === 0) return
    if (current < newBadges.length - 1) {
      const t = setTimeout(() => setCurrent(c => c + 1), 2500)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setVisible(false), 2500)
      return () => clearTimeout(t)
    }
  }, [visible, current, newBadges.length])

  if (!visible || newBadges.length === 0) return null

  const label = badgeLabels[newBadges[current]] ?? newBadges[current]

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="flex items-center gap-2 bg-pos text-pos-t text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap animate-bounce">
        <span>🏆</span>
        <span>初達成：{label}</span>
      </div>
    </div>
  )
}
