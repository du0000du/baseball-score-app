'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prevPathname = useRef<string | null>(null)
  const [visible, setVisible] = useState(true)
  const [displayedChildren, setDisplayedChildren] = useState(children)

  useEffect(() => {
    // 初回マウント
    if (prevPathname.current === null) {
      prevPathname.current = pathname
      setVisible(true)
      return
    }
    // ページ遷移時だけアニメーション
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      // 一瞬フェードアウト → 新コンテンツに差し替え → フェードイン
      setVisible(false)
      const t = setTimeout(() => {
        setDisplayedChildren(children)
        setVisible(true)
      }, 60)
      return () => clearTimeout(t)
    }
    // 同一パス内の再レンダリング（データ更新等）はそのまま反映
    setDisplayedChildren(children)
  }, [pathname, children])

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(5px)',
        transition: visible
          ? 'opacity 0.18s ease-out, transform 0.18s ease-out'
          : 'none',
      }}
    >
      {displayedChildren}
    </div>
  )
}
