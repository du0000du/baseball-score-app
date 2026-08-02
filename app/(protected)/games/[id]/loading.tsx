// PERF-3: クリック直後の即時フィードバックと prefetch の有効化
// 試合詳細・打席入力・投球入力の共通スケルトン
export default function GameDetailLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-pulse">
      <div className="h-4 w-24 bg-lv2 rounded" />
      <div className="flex gap-2">
        <div className="h-8 flex-1 bg-lv2 rounded-lg" />
        <div className="h-8 flex-1 bg-lv2 rounded-lg" />
      </div>
      <div className="bg-lv1 border border-s2 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-lv2 rounded" />
            <div className="h-6 w-32 bg-lv2 rounded" />
          </div>
          <div className="h-8 w-20 bg-lv2 rounded" />
        </div>
      </div>
      <div className="bg-lv1 rounded-xl border border-s2 p-5 space-y-4 min-h-[400px]">
        <div className="h-4 w-28 bg-lv2 rounded" />
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-11 bg-lv2 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-11 bg-lv2 rounded-lg" />)}
        </div>
      </div>
    </div>
  )
}
