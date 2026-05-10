/**
 * L6-4: オフラインキュー操作ヘルパー（クライアント専用）
 * Service Worker の IndexedDB キューにデータを追加し、
 * オンライン復帰時にフラッシュを指示する。
 */

export interface QueueItem {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  enqueuedAt: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('baseball-offline-queue', 1)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** キューに追加 */
export async function enqueueRequest(item: QueueItem): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    const req = tx.objectStore('queue').add(item)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** キューの件数を取得 */
export async function getQueueCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly')
    const req = tx.objectStore('queue').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Service Worker にフラッシュを指示 */
export async function flushQueue(): Promise<void> {
  if (!navigator.serviceWorker?.controller) return
  navigator.serviceWorker.controller.postMessage({ type: 'FLUSH_QUEUE' })
}

/** オンライン復帰ハンドラを登録（layout で一度だけ呼ぶ） */
export function registerOnlineHandler(onFlushed?: (count: number) => void): () => void {
  const handleOnline = () => flushQueue()
  window.addEventListener('online', handleOnline)

  const handleMessage = (e: MessageEvent) => {
    if (e.data?.type === 'QUEUE_FLUSHED' && onFlushed) {
      onFlushed(e.data.count as number)
    }
  }
  navigator.serviceWorker?.addEventListener('message', handleMessage)

  return () => {
    window.removeEventListener('online', handleOnline)
    navigator.serviceWorker?.removeEventListener('message', handleMessage)
  }
}
