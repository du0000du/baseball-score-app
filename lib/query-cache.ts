/**
 * L6-5: クライアントサイド クエリキャッシュ
 * Client Components で重複 Supabase リクエストを排除するためのシンプルなキャッシュ。
 * React.cache() はサーバーコンポーネント専用のため、クライアント側ではモジュールレベルの
 * Map + Promise deduplication で同等効果を実現する。
 */

type CacheEntry<T> = {
  data: T
  fetchedAt: number
}

const CACHE_TTL_MS = 30_000 // 30秒

class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private inflight = new Map<string, Promise<unknown>>()

  /**
   * キャッシュ付きでデータを取得する。
   * - TTL 内なら即座にキャッシュ値を返す
   * - 同一キーの fetch が inflight なら同じ Promise を返す（重複排除）
   * - それ以外は fetcher を実行してキャッシュに保存
   */
  async get<T>(key: string, fetcher: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
    const now = Date.now()
    const cached = this.cache.get(key)
    if (cached && now - cached.fetchedAt < ttl) {
      return cached.data as T
    }

    // in-flight deduplication
    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<T>
    }

    const promise = fetcher().then((data) => {
      this.cache.set(key, { data, fetchedAt: Date.now() })
      this.inflight.delete(key)
      return data
    }).catch((err) => {
      this.inflight.delete(key)
      throw err
    })

    this.inflight.set(key, promise)
    return promise
  }

  /** 特定キーのキャッシュを無効化（データ更新後に呼ぶ） */
  invalidate(keyPrefix: string) {
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key)
      }
    }
  }

  /** 全キャッシュをクリア */
  clear() {
    this.cache.clear()
    this.inflight.clear()
  }
}

// シングルトン（クライアントバンドル内でモジュールキャッシュとして機能）
export const queryCache = new QueryCache()
