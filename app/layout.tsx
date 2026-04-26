import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '草野球記録',
  description: '草野球の打撃成績を記録・管理するアプリ',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
