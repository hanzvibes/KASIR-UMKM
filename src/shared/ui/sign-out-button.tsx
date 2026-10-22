"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/shared/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith("kasir-umkm:offline-products-v1:") || key?.startsWith("kasir-umkm:catalog-preferences-v1:")) localStorage.removeItem(key);
    }
    localStorage.removeItem("kasir-umkm:offline-active-business-v1");
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith("kasir-umkm:checkout-")) sessionStorage.removeItem(key);
    }
    router.replace("/login");
    router.refresh();
  }
  return <button type="button" disabled={busy} onClick={signOut} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-60">{busy ? "Keluar…" : "Keluar dari akun"}</button>;
}
