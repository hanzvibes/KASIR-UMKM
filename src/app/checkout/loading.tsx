export default function Loading() {
  return (
    <main aria-busy="true" aria-label="Memuat layar kasir" className="min-h-screen bg-canvas pb-24 sm:pb-36 md:pb-44 xl:pb-12">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-7">
          <div className="skeleton h-9 w-9 shrink-0 rounded-xl" />
          <div className="skeleton h-4 w-44 max-w-[50%] rounded-full" />
          <div className="ml-auto skeleton h-11 w-11 shrink-0 rounded-xl" />
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-4 p-4 sm:p-7 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)] xl:items-start">
        <section className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="skeleton h-5 w-24 rounded-full" />
            <div className="skeleton h-7 w-32 rounded-full" />
          </div>
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="mt-3 flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-11 w-24 shrink-0 rounded-full" />)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="min-h-36 rounded-2xl border border-line p-3.5">
                <div className="skeleton h-3.5 w-4/5 rounded-full" />
                <div className="skeleton mt-2 h-3 w-1/2 rounded-full" />
                <div className="skeleton mt-10 h-5 w-24 rounded-full" />
                <div className="skeleton mt-2 h-3 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </section>
        <aside className="hidden h-fit rounded-2xl border border-line bg-white p-5 shadow-soft xl:block">
          <div className="skeleton h-5 w-28 rounded-full" />
          <div className="skeleton mt-4 h-14 w-full rounded-xl" />
          <div className="skeleton mt-3 h-28 w-full rounded-xl" />
          <div className="skeleton mt-3 h-12 w-full rounded-xl" />
          <div className="skeleton mt-4 h-12 w-full rounded-xl" />
        </aside>
      </div>
      <p className="sr-only">Memuat layar kasir…</p>
    </main>
  );
}
