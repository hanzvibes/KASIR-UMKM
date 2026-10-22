"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return <html lang="id"><body className="grid min-h-screen place-items-center bg-[#f5f7f5] p-5 text-[#17231d]"><main className="w-full max-w-md rounded-2xl border border-[#e1e7e2] bg-white p-6"><h1 className="text-xl font-bold">Halaman belum bisa dibuka</h1><p className="mt-2 text-sm leading-6 text-[#647067]">Terjadi kendala saat memuat aplikasi. Coba muat ulang.</p><button onClick={reset} className="mt-5 min-h-11 rounded-xl bg-[#1d754b] px-4 font-semibold text-white">Coba lagi</button></main></body></html>;
}
