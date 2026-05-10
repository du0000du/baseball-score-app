'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="text-5xl">⚠️</div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-main">エラーが発生しました</h2>
        <p className="text-sm text-sub1">
          予期しないエラーが発生しました。もう一度お試しください。
        </p>
        {error.digest && (
          <p className="text-xs text-sub2 font-mono">ID: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-theme text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-sm btn"
      >
        再試行する
      </button>
    </div>
  )
}
