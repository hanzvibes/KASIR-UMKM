import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-white md:grid-cols-2">
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 inline-flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white">K</span>
            <strong className="text-lg">Kasir UMKM</strong>
          </Link>
          <p className="mb-2 text-sm font-semibold text-brand">Selamat datang kembali</p>
          <h1 className="text-3xl font-bold tracking-tight">Masuk ke akunmu</h1>
          <p className="mt-2 text-sm leading-6 text-muted">Kelola transaksi dan pantau usaha dari satu tempat.</p>
          <div className="mt-8"><LoginForm /></div>
        </div>
      </section>
      <aside className="hidden flex-col justify-between bg-[#172d22] p-12 text-white md:flex">
        <div className="text-sm font-semibold tracking-wide text-white/70">KASIR UMKM</div>
        <div className="max-w-md">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><span className="text-2xl">↗</span></div>
          <h2 className="text-4xl font-bold leading-tight">Usaha rapi.<br />Keputusan lebih pasti.</h2>
          <p className="mt-5 max-w-sm leading-7 text-white/65">Catat penjualan, kelola produk, dan pahami kondisi usaha tanpa ribet.</p>
        </div>
        <p className="text-xs text-white/45">Dibuat untuk usaha kecil Indonesia.</p>
      </aside>
    </main>
  );
}
