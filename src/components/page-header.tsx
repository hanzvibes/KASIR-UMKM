import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export default function PageHeader({
  title,
  subtitle,
  backHref,
  action,
  width = "max-w-6xl",
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: ReactNode;
  width?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-white/90 shadow-[0_2px_12px_rgba(23,35,29,0.025)] backdrop-blur-xl">
      <div className={`mx-auto flex ${width} items-center gap-3 px-4 py-3 sm:px-7`}>
        {backHref && (
          <Link
            href={backHref}
            aria-label="Kembali"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line text-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight tracking-tight sm:text-xl">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted sm:text-sm">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}
