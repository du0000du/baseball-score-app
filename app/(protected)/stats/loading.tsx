// PERF-3: クリック直後の即時フィードバックと prefetch の有効化
export default function StatsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-pulse">
        <div className="h-8 w-20 bg-lv2 rounded" />
        <div className="h-9 w-24 bg-lv2 rounded-lg" />
      </div>
      <div className="h-9 w-28 bg-lv2 rounded-lg animate-pulse" />
      <div className="flex gap-3 overflow-hidden border-b border-s2 pb-2 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-6 w-20 bg-lv2 rounded shrink-0" />)}
      </div>
      <div className="space-y-3 min-h-[520px]">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-lv1 rounded-xl border border-s2 p-6 animate-pulse">
            <div className="h-4 bg-lv2 rounded w-1/4 mb-4" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(j => <div key={j} className="h-10 bg-lv2 rounded" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
