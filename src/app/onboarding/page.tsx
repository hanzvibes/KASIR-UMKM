import { OnboardingForm } from "./onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-6 shadow-soft sm:p-9">
        <span className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-xl font-bold text-brand">K</span>
        <p className="text-sm font-semibold text-brand">Penyiapan 3 langkah</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Siapkan kasir usahamu</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Isi profil usaha, pilih produk awal, lalu kasir siap digunakan. Tidak lama kok.</p>
        <div className="mt-7"><OnboardingForm /></div>
      </div>
    </main>
  );
}
