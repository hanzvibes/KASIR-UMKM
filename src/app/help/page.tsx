import Link from "next/link";
import PageHeader from "@/components/page-header";

const guides = [
  ["Mulai shift", "Buka menu Kelola → Buka / tutup kasir. Hitung uang di laci, masukkan modal awal, lalu pilih Buka kasir."],
  ["Mencatat penjualan", "Cari nama atau kode produk, ketuk produk untuk memasukkannya ke keranjang, pilih pembayaran, lalu selesaikan transaksi."],
  ["Kas masuk dan keluar", "Di halaman shift yang sedang berjalan, pilih jenis pergerakan, isi nominal dan alasan, lalu simpan."],
  ["Menutup shift", "Hitung uang fisik di laci, masukkan hasil hitung, lalu pilih Tutup shift. Selisih akan tercatat di laporan."],
  ["Mengelola produk", "Buka menu Kelola → Produk & stok. Pemilik bisa menambah atau mengubah produk dan harga."],
];

export default function HelpPage() {
  return <main className="min-h-screen bg-canvas pb-24"><PageHeader title="Bantuan" subtitle="Panduan singkat penggunaan kasir." backHref="/manage" width="max-w-3xl" /><div className="mx-auto max-w-3xl space-y-3 p-4 sm:p-7">{guides.map(([title, body], index) => <details key={title} open={index === 0} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-semibold">{title}</summary><p className="mt-3 text-sm leading-6 text-muted">{body}</p></details>)}<div className="flex gap-4 px-1 pt-2 text-sm"><Link href="/privacy" className="text-brand underline">Kebijakan privasi</Link><Link href="/terms" className="text-brand underline">Syarat penggunaan</Link></div></div></main>;
}
