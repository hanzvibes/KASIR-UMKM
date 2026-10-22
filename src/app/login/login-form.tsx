"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabasePublicEnv } from "@/lib/env";

export function LoginForm() {
  const router = useRouter();
  const env = getSupabasePublicEnv();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!env.configured) {
      setMessage(`Konfigurasi belum lengkap: ${env.missing.join(", ")}. Isi .env.local dari .env.example.`);
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/checkout");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMessage("Akun dibuat. Periksa email untuk konfirmasi, lalu masuk.");
        } else {
          router.replace("/onboarding");
          router.refresh();
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-line px-4 py-3 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10" placeholder="nama@email.com" />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">Kata sandi</label>
        <input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-line px-4 py-3 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10" placeholder="Minimal 8 karakter" />
      </div>
      {message && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{message}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white transition hover:bg-[#196640] disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Memproses..." : mode === "signin" ? "Masuk" : "Buat akun"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "signin" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }} className="font-semibold text-brand hover:underline">
          {mode === "signin" ? "Daftar sekarang" : "Masuk"}
        </button>
      </p>
    </form>
  );
}
