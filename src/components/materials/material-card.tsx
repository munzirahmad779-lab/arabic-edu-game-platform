import Link from "next/link";
import type { ReactNode } from "react";

type MaterialCardProps = {
  href: string;
  index: number;
  title: string;
  subtitle: string;
  badges?: ReactNode;
};

export function MaterialCard({
  href,
  index,
  title,
  subtitle,
  badges,
}: MaterialCardProps) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white shadow-md shadow-violet-200 transition-transform duration-200 group-hover:scale-110">
            {index}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-neutral-900 group-hover:text-violet-700">
              {title}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
            {badges ? (
              <div className="mt-1.5 flex flex-wrap gap-1">{badges}</div>
            ) : null}
          </div>
        </div>
        <span className="text-2xl text-neutral-300 transition duration-200 group-hover:translate-x-[-2px] group-hover:text-violet-600">
          ←
        </span>
      </div>
    </Link>
  );
}