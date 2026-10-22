"use client";

export default function ShareReceipt({ token, invoice, total }: { token: string; invoice: string | null; total: number }) {
  const share = () => {
    const url = `${window.location.origin}/r/${token}`;
    const summary = `Terima kasih sudah berbelanja!\n${invoice ?? "Struk pembayaran"}\nTotal: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(total)}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank", "noopener,noreferrer");
  };
  return <button type="button" onClick={share} className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-center text-sm font-semibold">Bagikan ke WhatsApp</button>;
}
