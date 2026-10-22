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
      const { error } = await supabase.rpc("create_business", { business_name: name.trim() });
      if (error) throw error;
      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Usaha belum bisa dibuat. Coba lagi.");
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
