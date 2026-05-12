import type { Metadata, Viewport } from 'next'
import './globals.css'
import ThemeProvider from './(protected)/_components/ThemeProvider'

export const metadata: Metadata = {
  title: {
    template: '%s | 草野球記録',
    default: '草野球記録',
  },
  description: '草野球の打撃成績を記録・管理するアプリ',
}

// R-7: PWA standalone モード（ホーム画面追加後の Web アプリ化）で
// safe-area-inset 環境変数を有効化するため viewport-fit=cover を設定。
// これにより Nav.tsx 等の fixed 要素が iOS ホームインジケータ／画面端の丸みを
// 考慮した padding を `env(safe-area-inset-*)` で取得できるようになる。
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
