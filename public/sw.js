/**
 * L6-4: PWA フェーズ2 — オフラインキュー付き Service Worker
 * IndexedDB に打席データをキューイングし、オンライン復帰時に自動同期する。
 */

const CACHE_NAME = 'baseball-v2'
const STATIC_ASSETS = ['/', '/dashboard', '/stats', '/games', '/settings']

// ====== Install ======
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// ====== Activate ======
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ====== Fetch: キャッシュファースト（API は除外） ======
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Supabase API / Next.js API は常にネットワーク
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((res) => {
        // GET リクエストのみキャッシュ
        if (event.request.method === 'GET' && res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return res
      }).catch(() => cached ?? new Response('Offline', { status: 503 }))
    })
  )
})

// ====== IndexedDB ヘルパー ======
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('baseball-offline-queue', 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getQueuedItems(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly')
    const req = tx.objectStore('queue').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function deleteQueuedItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite')
    const req = tx.objectStore('queue').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ====== オンライン復帰時: キュー フラッシュ ======
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'FLUSH_QUEUE') {
    try {
      const db = await openDB()
      const items = await getQueuedItems(db)
      let flushed = 0
      for (const item of items) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body,
          })
          if (res.ok) {
            await deleteQueuedItem(db, item.id)
            flushed++
          }
        } catch {
          // ネットワーク依然不可 → スキップ
        }
      }
      // クライアントに通知
      const clients = await self.clients.matchAll()
      clients.forEach((c) => c.postMessage({ type: 'QUEUE_FLUSHED', count: flushed }))
    } catch (err) {
      console.error('[SW] flush error:', err)
    }
  }
})
