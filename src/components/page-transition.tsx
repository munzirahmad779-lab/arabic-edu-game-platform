"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const TRANSITION_CSS = `
  @keyframes pageFadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .page-transition-wrapper {
    animation: pageFadeIn 0.35s ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .page-transition-wrapper {
      animation: none;
    }
  }
`;

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const el = ref.current;
    if (!el) return;

    // Restart CSS animation tanpa remount subtree (state tetap aman)
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = "";
  }, [pathname]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TRANSITION_CSS }} />
      <div ref={ref} className="page-transition-wrapper">
        {children}
      </div>
    </>
  );
}