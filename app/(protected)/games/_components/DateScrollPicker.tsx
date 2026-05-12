'use client'

type Props = {
  value: string // 'YYYY-MM-DD'
  onChange: (value: string) => void
}

export function DateScrollPicker({ value, onChange }: Props) {
  const today = new Date()
  const parts = value ? value.split('-') : [
    String(today.getFullYear()),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ]
  const year  = parseInt(parts[0])
  const month = parseInt(parts[1])
  const day   = parseInt(parts[2])

  const currentYear = today.getFullYear()
  const years  = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const maxDay = new Date(year, month, 0).getDate()
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1)

  const handleChange = (y: number, m: number, d: number) => {
    const clampedDay = Math.min(d, new Date(y, m, 0).getDate())
    onChange(
      `${y}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
    )
  }

  const cls = 'text-base border border-s2 rounded-lg py-2 bg-lv1 text-main focus:outline-none focus:ring-2 focus:ring-theme text-center'

  return (
    <div className="flex gap-2 items-center">
      <select
        value={year}
        onChange={e => handleChange(Number(e.target.value), month, day)}
        className={`${cls} w-24`}
      >
        {years.map(y => <option key={y} value={y}>{y}年</option>)}
      </select>
      <select
        value={month}
        onChange={e => handleChange(year, Number(e.target.value), day)}
        className={`${cls} w-16`}
      >
        {months.map(m => <option key={m} value={m}>{m}月</option>)}
      </select>
      <select
        value={day}
        onChange={e => handleChange(year, month, Number(e.target.value))}
        className={`${cls} w-16`}
      >
        {days.map(d => <option key={d} value={d}>{d}日</option>)}
      </select>
    </div>
  )
}
