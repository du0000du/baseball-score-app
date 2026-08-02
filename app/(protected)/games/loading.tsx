// PERF-3: クリック直後の即時フィードバックと prefetch の有効化
export default function GamesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-28 bg-lv2 rounded" />
        <div className="h-9 w-28 bg-lv2 rounded-lg" />
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-8 w-20 bg-lv2 rounded-lg" />)}
      </div>
      <div className="space-y-2 min-h-[520px]">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-lv1 rounded-xl border border-s2 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-40 bg-lv2 rounded" />
                <div className="h-3 w-24 bg-lv2 rounded" />
              </div>
              <div className="h-6 w-16 bg-lv2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
