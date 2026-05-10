'use client'
/**
 * L6-4: オフライン状態バナー
 * ネットワーク断絶時にトップに固定バナーを表示し、
 * オンライン復帰後にキューフラッシュを実行する。
 */

import { useEffect, useState } from 'react'
import { getQueueCount, registerOnlineHandler } from '@/lib/offline-queue'

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const [flushedCount, setFlushedCount] = useState(0)

  useEffect(() => {
    // 初期状態チェック
    setIsOffline(!navigator.onLine)

    // キュー件数確認
    const checkQueue = async () => {
      try {
        const count = await getQueueCount()
        setQueueCount(count)
      } catch {}
    }
    checkQueue()

    const handleOffline = () => setIsOffline(true)
    const handleOnline = async () => {
      setIsOffline(false)
      await checkQueue()
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // SW メッセージ受信でフラッシュ完了通知
    const cleanup = registerOnlineHandler(async (count) => {
      setFlushedCount(count)
      await checkQueue()
      setTimeout(() => setFlushedCount(0), 4000)
    })

    // SW 登録
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      cleanup()
    }
  }, [])

  if (!isOffline && queueCount === 0 && flushedCount === 0) return null

  return (
    <>
      {/* オフライン中バナー */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-neu text-neu-t text-xs font-semibold text-center py-1.5 px-4">
          📵 オフライン中 {queueCount > 0 ? `— ${queueCount}件の打席データを保留中` : ''}
        </div>
      )}
      {/* オンライン復帰・フラッシュ完了通知 */}
      {flushedCount > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-pos text-pos-t text-sm font-semibold px-4 py-2 rounded-full shadow-lg z-50 whitespace-nowrap animate-fade-in-out">
          ✓ {flushedCount}件の保留データを同期しました
        </div>
      )}
    </>
  )
}
