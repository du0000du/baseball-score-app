// PERF-3: loading.tsx があると、クリック直後にスケルトンが出るうえ
// <Link> の prefetch が実際に効くようになる（動的ルートは loading 境界までprefetchされる）
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-32 bg-lv2 rounded" />
        <div className="h-9 w-28 bg-lv2 rounded-lg" />
      </div>
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-6 lg:space-y-0">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-lv1 rounded-xl border border-s2 p-5">
            <div className="h-4 w-24 bg-lv2 rounded mb-4" />
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-lv2 rounded" />)}
            </div>
          </div>
          <div className="bg-lv1 rounded-xl border border-s2 p-6">
            <div className="h-4 w-32 bg-lv2 rounded mb-4" />
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-lv2 rounded" />)}
            </div>
            <div className="grid grid-cols-7 gap-1 pt-4 border-t border-s2">
              {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="h-8 bg-lv2 rounded" />)}
            </div>
          </div>
          <div className="bg-lv1 rounded-xl border border-s2 p-5">
            <div className="h-4 w-28 bg-lv2 rounded mb-3" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-8 bg-lv2 rounded" />)}
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-lv1 rounded-xl border border-s2 p-6">
            <div className="h-4 w-24 bg-lv2 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-lv2 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
