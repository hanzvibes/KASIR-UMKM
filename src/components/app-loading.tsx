export default function AppLoading({ cards = 4, rows = 5 }: { cards?: number; rows?: number }) {
  return (
    <main className="min-h-screen bg-canvas pb-24" aria-busy="true" aria-label="Memuat halaman">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-7">
          <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-4 w-40 max-w-full rounded-full" />
            <div className="skeleton h-3 w-56 max-w-full rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-7">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <div className="skeleton h-3 w-20 rounded-full" />
              <div className="skeleton mt-4 h-6 w-28 rounded-full" />
              <div className="skeleton mt-2 h-3 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-line p-4 last:border-b-0">
              <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-3.5 w-2/5 rounded-full" />
                <div className="skeleton h-3 w-3/5 rounded-full" />
              </div>
              <div className="skeleton h-4 w-16 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
