// Shared pieces of the lavender theme (no hooks, so server and client pages
// can both use them).
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/format";

/** The RAAHI logo, as on the caller site: the राही wordmark (Yatra One) over
 *  its name. `tag` puts a small label, e.g. the platform's name, beside it. */
export function RaahiLogo({ size = "md", tag }: { size?: "md" | "lg"; tag?: string }) {
  return (
    <span className={cn("text-halo flex flex-col", size === "lg" && "items-center")}>
      <span className="flex items-center gap-3">
        <span
          lang="hi"
          className={cn(
            "font-logo text-ink",
            // leading after the size: tailwind-merge drops a line-height set before one
            size === "lg" ? "text-[4.75rem] leading-none" : "text-[2.5rem] leading-none sm:text-[3rem]",
          )}
        >
          राही
        </span>
        {tag && (
          <span className="hidden rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 sm:inline">
            {tag}
          </span>
        )}
      </span>
      <span
        className={cn(
          "font-semibold uppercase leading-snug text-ink-soft",
          size === "lg" ? "mt-2.5 text-[12px] tracking-[0.16em]" : "mt-1.5 text-[9px] tracking-[0.14em] sm:text-[10px]",
        )}
      >
        RAAHI - Rural AI Advisor for Household Income
      </span>
    </span>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("h-3.5 w-3.5", className)}>
      <path d="M5 11 11 5M6.5 5H11v4.5" stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The white square holding ↗ at the end of a primary button. */
export function ArrowSquare() {
  return (
    <span className="btn-arrow">
      <ArrowIcon />
    </span>
  );
}

/** Round ↗ in the corner of a linked card; `label` is read out instead. */
export function ArrowCircle({ label }: { label?: string }) {
  return (
    <span className="arrow-btn">
      <ArrowIcon />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function PageHeader({ eyebrow, title, titleClassName, children }: {
  eyebrow?: string;
  title: React.ReactNode;
  titleClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="text-halo pt-6 sm:pt-10">
      {eyebrow && <span className="eyebrow mb-4">{eyebrow}</span>}
      <h1
        className={cn(
          "text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-ink sm:text-[2.6rem]",
          titleClassName,
        )}
      >
        {title}
      </h1>
      {children && (
        <div className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{children}</div>
      )}
    </header>
  );
}

/** A KPI: label over a large number (proportional figures, Indian grouping). */
export function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="text-xs font-medium text-ink-soft sm:text-sm">{label}</div>
      <div className="mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-ink sm:text-[2.1rem]">
        {fmt(value)}
      </div>
      {note && <div className="mt-1.5 text-xs text-ink-faint">{note}</div>}
    </div>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className={cn("h-4 w-4", className)}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A card with a title, an optional subtitle and its content. */
export function Panel({ title, subtitle, action, className, children }: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
