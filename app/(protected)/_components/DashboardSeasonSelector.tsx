'use client'

import { useRouter } from 'next/navigation'

interface Props {
  currentYear: number
  selectedYear: number
}

export default function DashboardSeasonSelector({ currentYear, selectedYear }: Props) {
  const router = useRouter()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <select
      value={selectedYear}
      onChange={(e) => router.replace(`/dashboard?year=${e.target.value}`, { scroll: false })}
      className="border border-s2 rounded-lg px-3 py-1.5 text-sm bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme transition-shadow duration-150"
    >
      {years.map((y) => (
        <option key={y} value={y}>{y}年</option>
      ))}
    </select>
  )
}
