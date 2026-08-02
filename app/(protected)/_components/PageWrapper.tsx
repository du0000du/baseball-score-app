'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prevPathname = useRef<string | null>(null)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (prevPathname.current === null) {
      prevPathname.current = pathname
      setVisible(true)
      return
    }
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      // PERF-4: 従来は 60ms の強制空白を挟んでいたが、
      // 遷移そのものが待たされている状況では体感悪化にしかならないため撤廃。
      // 次フレームで表示に戻し、フェードは transition だけで成立させる。
      setVisible(false)
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [pathname])

  return (
    <div
      className="min-h-0"
      style={{
        opacity: visible ? 1 : 0,
        transition: visible ? 'opacity 0.1s ease-out' : 'none',
      }}
    >
      {children}
    </div>
  )
}
