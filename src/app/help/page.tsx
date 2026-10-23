import Link from "next/link";
import PageHeader from "@/components/page-header";

const guides = [
  ["Mulai shift", "Di layar kasir, buka menu ⋮ di kanan atas lalu pilih Buka kasir. Bisa juga lewat Kelola → Kas & shift. Hitung uang di laci, masukkan modal awal, lalu pilih Buka kasir."],
  ["Mencatat penjualan", "Cari nama atau kode produk, ketuk produk untuk memasukkannya ke keranjang, pilih pembayaran, lalu selesaikan transaksi."],
  ["Kas masuk dan keluar", "Di layar kasir, buka menu ⋮ lalu pilih Catat kas. Pilih jenis pergerakan, isi nominal dan alasan, lalu simpan."],
  ["Menutup shift", "Buka menu ⋮ di layar kasir, pilih Tutup shift, masukkan uang fisik di laci, lalu konfirmasi. Laporan penutupan langsung tampil dan bisa dicetak."],
  ["Mengelola produk", "Buka menu Kelola → Produk & stok. Pemilik bisa menambah atau mengubah produk dan harga."],
  ["Stok menipis", "Di Kelola → Produk & stok, panel Stok perlu perhatian menampilkan produk aktif dengan stok 5 atau kurang, termasuk yang habis. Pemilik bisa langsung mengisi jumlah stok masuk di panel itu; kasir bisa melihat daftar yang perlu disiapkan."],
  ["Mencari transaksi", "Buka Transaksi lalu masukkan nomor invoice dari struk, misalnya INV-20261023-0001. Filter status dan metode pembayaran membantu mempersempit hasil di halaman tersebut."],
];

export default function HelpPage() {
  return <main className="min-h-screen bg-canvas pb-24"><PageHeader title="Bantuan" subtitle="Panduan singkat penggunaan kasir." backHref="/manage" width="max-w-3xl" /><div className="mx-auto max-w-3xl space-y-3 p-4 sm:p-7">{guides.map(([title, body], index) => <details key={title} open={index === 0} className="rounded-2xl border border-line bg-white p-5"><summary className="cursor-pointer font-semibold">{title}</summary><p className="mt-3 text-sm leading-6 text-muted">{body}</p></details>)}<div className="flex gap-4 px-1 pt-2 text-sm"><Link href="/privacy" className="text-brand underline">Kebijakan privasi</Link><Link href="/terms" className="text-brand underline">Syarat penggunaan</Link></div></div></main>;
}
