export default function Loading() {
  return (
    <main aria-busy="true" aria-live="polite" className="min-h-screen bg-canvas">
      <div className="sticky top-0 z-20 border-b border-line bg-white/95 px-4 py-4 backdrop-blur sm:px-7">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-skeleton" />
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-skeleton" />
            <div className="h-3 w-52 animate-pulse rounded bg-skeleton" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-7">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-skeleton" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-skeleton" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-4 rounded-2xl border border-line bg-white p-5">
              <div className="h-4 w-28 animate-pulse rounded bg-skeleton" />
              <div className="h-8 w-36 animate-pulse rounded bg-skeleton" />
              <div className="h-3 w-24 animate-pulse rounded bg-skeleton" />
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <div className="h-5 w-40 animate-pulse rounded bg-skeleton" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-skeleton" />
          ))}
        </div>
      </div>
      <p className="sr-only">Memuat halaman…</p>
    </main>
  );
}
