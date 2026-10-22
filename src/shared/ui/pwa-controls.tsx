"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export default function PwaControls() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);

    let updateActivation = false;
    const onControllerChange = () => {
      if (updateActivation) window.location.reload();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        const checkWaiting = () => {
          updateActivation = Boolean(registration.waiting && navigator.serviceWorker.controller);
          setUpdateReady(updateActivation);
        };
        checkWaiting();
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", checkWaiting);
        });
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      }).catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    setShowIosHelp(true);
  }

  function refresh() {
    navigator.serviceWorker?.getRegistration().then((registration) => {
      if (registration?.waiting) {
        // Reload after the new worker takes control.
        navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }

  return <>
    {!online && <div role="status" className="fixed inset-x-0 top-0 z-[70] bg-amber-900 px-4 py-2 text-center text-sm font-semibold text-white">Offline · Penjualan tidak bisa disimpan</div>}
    <div className="fixed right-3 top-3 z-[60] flex gap-2 print:hidden">
      {(installPrompt || /iPhone|iPad|iPod/i.test(typeof navigator === "undefined" ? "" : navigator.userAgent)) && <button type="button" onClick={install} className="min-h-10 rounded-full border border-line bg-white px-3 text-xs font-semibold shadow">Install app</button>}
      {updateReady && <button type="button" onClick={refresh} className="min-h-10 rounded-full bg-brand px-3 text-xs font-semibold text-white shadow">Versi baru tersedia · Refresh</button>}
    </div>
    {showIosHelp && <div role="presentation" onClick={() => setShowIosHelp(false)} className="fixed inset-0 z-[80] grid items-end bg-black/40 p-3 sm:items-center sm:justify-center"><section role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()} className="rounded-2xl bg-white p-5 shadow-xl sm:max-w-sm"><h2 id="install-title" className="font-bold">Pasang Kasir UMKM</h2><p className="mt-2 text-sm leading-6 text-muted">Di Safari, ketuk tombol <strong>Bagikan</strong>, lalu pilih <strong>Tambahkan ke Layar Utama</strong>.</p><button type="button" onClick={() => setShowIosHelp(false)} className="mt-4 min-h-11 w-full rounded-xl bg-brand font-semibold text-white">Mengerti</button></section></div>}
  </>;
}
