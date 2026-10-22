"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const steps = ["Profil usaha", "Produk awal", "Selesai"];

export function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("lainnya");
  const [productPlan, setProductPlan] = useState<"sample" | "custom" | "empty">("empty");
  const [initialProductName, setInitialProductName] = useState("");
  const [initialProductPrice, setInitialProductPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    if (step < 3) {
      if (step === 1 && !name.trim()) {
        setErrorMessage("Isi nama usaha dulu agar kasir bisa menampilkan nama yang benar.");
        return;
      }
      if (step === 2 && productPlan === "custom" && (!initialProductName.trim() || !/^\d{1,14}$/.test(initialProductPrice))) {
        setErrorMessage("Isi nama dan harga produk pertama dengan benar, atau pilih opsi lain.");
        return;
      }
      setStep((current) => current + 1);
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Sesi login tidak ditemukan. Silakan masuk lagi.");
      const { error } = await supabase.rpc("kasir_create_business_wizard", {
        business_name: name.trim(),
        business_type: businessType,
        p_load_sample: productPlan === "sample",
        p_initial_products: productPlan === "custom"
          ? [{ name: initialProductName.trim(), price: initialProductPrice, sku: null }]
          : [],
      });
      if (error) throw error;
      setDone(true);
    } catch (error) {
      const details = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : error instanceof Error
          ? error.message
          : "";
      const code = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

      if (code === "23505") {
        setDone(true);
      } else if (code === "42501" || code === "PGRST301") {
        setErrorMessage("Akses ditolak oleh database. Periksa kebijakan akses Supabase untuk pembuatan usaha.");
      } else if (code === "PGRST202" || code === "42883") {
        setErrorMessage("Fitur penyiapan usaha belum tersedia. Minta pemilik usaha memperbarui database.");
      } else if (details) {
        setErrorMessage(`Usaha belum bisa dibuat: ${details}`);
      } else {
        setErrorMessage("Usaha belum bisa dibuat. Periksa koneksi lalu coba lagi.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5 text-center" role="status">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-2xl font-bold text-brand">✓</span>
        <div><p className="text-sm font-semibold text-brand">Langkah 3 dari 3</p><h2 className="mt-1 text-2xl font-bold">Usaha siap digunakan</h2><p className="mt-2 text-sm leading-6 text-muted">{productPlan === "sample" ? "Contoh produk sudah ditambahkan." : productPlan === "custom" ? `${initialProductName.trim()} sudah masuk ke daftar produk.` : "Kamu bisa menambahkan produk kapan saja dari menu Produk."} Selanjutnya buka kasir dan catat uang awal shift.</p></div>
        <Link href={productPlan === "empty" ? "/products" : "/shifts"} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-[#196640]">{productPlan === "empty" ? "Tambahkan produk pertama" : "Buka kasir"}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <ol aria-label="Tahap penyiapan usaha" className="grid grid-cols-3 gap-2">
        {steps.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const complete = number < step;
          return <li key={label} aria-current={active ? "step" : undefined} className={`rounded-xl px-2 py-2 text-center text-xs font-semibold ${active ? "bg-brand text-white" : complete ? "bg-brand-soft text-brand" : "bg-canvas text-muted"}`}><span className="block">{complete ? "✓" : number}</span>{label}</li>;
        })}
      </ol>

      {step === 1 && <section className="space-y-4" aria-labelledby="business-step-title">
        <div><h2 id="business-step-title" className="font-semibold">Kenali usaha kamu</h2><p className="mt-1 text-sm text-muted">Nama ini akan tampil di kasir dan struk.</p></div>
        <label className="grid gap-2 text-sm font-medium">Nama usaha
          <input autoFocus required minLength={1} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Kedai Kopi Rehan" className="min-h-12 w-full rounded-xl border border-line px-4 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
        </label>
        <label className="grid gap-2 text-sm font-medium">Jenis usaha
          <select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className="min-h-12 w-full rounded-xl border border-line bg-white px-4">
            <option value="makanan">Makanan</option><option value="minuman">Minuman</option><option value="retail">Toko / retail</option><option value="jasa">Jasa</option><option value="lainnya">Lainnya</option>
          </select>
        </label>
      </section>}

      {step === 2 && <fieldset className="space-y-3">
        <legend className="font-semibold">Siapkan produk awal</legend>
        <p className="mb-4 text-sm text-muted">Pilih contoh produk untuk mulai mencoba, atau tambahkan produk sendiri nanti.</p>
        <label className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-4 ${productPlan === "sample" ? "border-brand bg-brand-soft/40" : "border-line"}`}>
          <input type="radio" name="initial-products" checked={productPlan === "sample"} onChange={() => setProductPlan("sample")} className="mt-1 h-4 w-4 accent-[#1d754b]" />
          <span className="text-sm"><strong className="block">Isi contoh produk</strong><span className="mt-1 block text-muted">Kopi susu, es teh, dan roti cokelat. Bisa diubah atau dihapus nanti.</span></span>
        </label>
        <label className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-4 ${productPlan === "custom" ? "border-brand bg-brand-soft/40" : "border-line"}`}>
          <input type="radio" name="initial-products" checked={productPlan === "custom"} onChange={() => setProductPlan("custom")} className="mt-1 h-4 w-4 accent-[#1d754b]" />
          <span className="text-sm"><strong className="block">Masukkan produk pertama</strong><span className="mt-1 block text-muted">Isi nama dan harga. Produk lain bisa ditambahkan nanti.</span></span>
        </label>
        {productPlan === "custom" && <div className="grid gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Nama produk<input autoFocus required maxLength={160} value={initialProductName} onChange={(event) => setInitialProductName(event.target.value)} placeholder="Contoh: Nasi goreng" className="min-h-11 rounded-lg border border-line bg-white px-3 font-normal" /></label><label className="grid gap-1.5 text-sm font-medium">Harga jual (Rp)<input required type="number" min="0" step="1" value={initialProductPrice} onChange={(event) => setInitialProductPrice(event.target.value)} placeholder="15000" className="min-h-11 rounded-lg border border-line bg-white px-3 font-normal" /></label></div>}
        <label className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-4 ${productPlan === "empty" ? "border-brand bg-brand-soft/40" : "border-line"}`}>
          <input type="radio" name="initial-products" checked={productPlan === "empty"} onChange={() => setProductPlan("empty")} className="mt-1 h-4 w-4 accent-[#1d754b]" />
          <span className="text-sm"><strong className="block">Tambahkan nanti</strong><span className="mt-1 block text-muted">Lewati produk untuk sekarang dan isi dari menu Produk.</span></span>
        </label>
      </fieldset>}

      {step === 3 && <section className="space-y-3 rounded-2xl bg-canvas p-4" aria-labelledby="review-title">
        <div><h2 id="review-title" className="font-semibold">Periksa sebelum mulai</h2><p className="mt-1 text-sm text-muted">Semua ini masih bisa diubah nanti.</p></div>
        <div className="flex justify-between gap-3 border-t border-line pt-3 text-sm"><span className="text-muted">Nama usaha</span><strong className="text-right">{name.trim()}</strong></div>
        <div className="flex justify-between gap-3 text-sm"><span className="text-muted">Jenis usaha</span><strong>{businessType.charAt(0).toUpperCase() + businessType.slice(1)}</strong></div>
        <div className="flex justify-between gap-3 text-sm"><span className="text-muted">Produk awal</span><strong className="text-right">{productPlan === "sample" ? "3 contoh produk" : productPlan === "custom" ? `${initialProductName.trim()} · Rp ${new Intl.NumberFormat("id-ID").format(Number(initialProductPrice) || 0)}` : "Tambahkan sendiri nanti"}</strong></div>
      </section>}

      {errorMessage && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{errorMessage}</p>}
      <div className="flex gap-3">
        {step > 1 && <button type="button" disabled={busy} onClick={() => { setErrorMessage(""); setStep((current) => current - 1); }} className="min-h-12 flex-1 rounded-xl border border-line px-4 font-semibold disabled:opacity-60">Kembali</button>}
        <button type="submit" disabled={busy} className="min-h-12 flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-white transition hover:bg-[#196640] disabled:opacity-60">
          {busy ? "Menyiapkan usaha…" : step < 3 ? "Lanjut" : "Buat usaha"}
        </button>
      </div>
    </form>
  );
}
