"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Sesi login tidak ditemukan. Silakan masuk lagi.");
      const { error } = await supabase.rpc("kasir_create_business", { business_name: name.trim() });
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch (error) {
      // Supabase/PostgREST errors are plain objects, not always Error instances.
      const details = error && typeof error === "object" && "message" in error
        ? String(error.message)
        : error instanceof Error
          ? error.message
          : "";
      const code = error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";

      if (code === "23505") {
        setErrorMessage("Profil usaha ini sudah pernah dibuat. Muat ulang halaman dan coba masuk ke dashboard.");
      } else if (code === "42501" || code === "PGRST301") {
        setErrorMessage("Akses ditolak oleh database. Periksa kebijakan akses Supabase untuk pembuatan usaha.");
      } else if (code === "PGRST202" || code === "42883") {
        setErrorMessage("Fungsi kasir_create_business belum tersedia di database. Terapkan migrasi Supabase terbaru lalu coba lagi.");
      } else if (details) {
        setErrorMessage(`Usaha belum bisa dibuat: ${details}`);
      } else {
        setErrorMessage("Usaha belum bisa dibuat. Periksa koneksi Supabase lalu coba lagi.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="business-name" className="mb-2 block text-sm font-medium">Nama usaha</label>
        <input id="business-name" required minLength={1} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Kedai Kopi Rehan" className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" />
      </div>
      {errorMessage && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{errorMessage}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white transition hover:bg-[#196640] disabled:opacity-60">
        {busy ? "Menyimpan..." : "Buat profil usaha"}
      </button>
    </form>
  );
}
