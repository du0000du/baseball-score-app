'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prevPathname = useRef<string | null>(null)
  const [visible, setVisible] = useState(true)
  const [displayedChildren, setDisplayedChildren] = useState(children)

  useEffect(() => {
    if (prevPathname.current === null) {
      prevPathname.current = pathname
      setVisible(true)
      return
    }
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setVisible(false)
      const t = setTimeout(() => {
        setDisplayedChildren(children)
        setVisible(true)
      }, 60)
      return () => clearTimeout(t)
    }
    setDisplayedChildren(children)
  }, [pathname, children])

  return (
    <div
      className="min-h-[calc(100vh-5rem)]"
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
