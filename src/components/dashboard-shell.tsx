"use client";

import { useState, useEffect } from "react";

export function DashboardShell({
  sidebar,
  headerLogo,
  headerTitle,
  headerRight,
  children,
  isRtl,
}: {
  sidebar: React.ReactNode;
  headerLogo: React.ReactNode;
  headerTitle: string;
  headerRight: React.ReactNode;
  children: React.ReactNode;
  isRtl: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("dashboard_sidebar_collapsed");
      if (stored === "true") {
        setIsCollapsed(true);
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const handleToggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dashboard_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="relative min-h-screen">
      {/* Sidebar container with collapsible desktop width */}
      <div
        className={`hidden lg:block fixed inset-y-0 z-30 transition-transform duration-300 ease-in-out w-60 ${
          isCollapsed
            ? isRtl
              ? "translate-x-full pointer-events-none opacity-0"
              : "-translate-x-full pointer-events-none opacity-0"
            : "translate-x-0 opacity-100"
        }`}
        style={{ insetInlineStart: 0 }}
      >
        <div className="relative h-full w-60">
          {sidebar}

          {/* Dedicated collapse button on desktop sidebar border */}
          <button
            type="button"
            onClick={handleToggle}
            className="absolute top-5 -right-3 z-40 flex h-7 w-7 items-center justify-center rounded-full border border-sage-200 bg-white text-xs font-black text-teal-700 shadow-md transition hover:scale-110 hover:bg-sage-50"
            title="Ciutkan Panel Menu"
            aria-label="Ciutkan Panel Menu"
          >
            {isRtl ? "▶" : "◀"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (always available via mobile hamburger inside sidebar) */}
      <div className="lg:hidden">{sidebar}</div>

      {/* Main Content Area with dynamic padding */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          mounted && isCollapsed ? "lg:ps-0" : "lg:ps-60"
        }`}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-sage-200/60 bg-white/95 ps-16 pe-4 py-3 backdrop-blur sm:px-6 lg:ps-6">
          <div className="flex items-center gap-3">
            {/* Desktop Expand Toggle Button (when collapsed) */}
            <button
              type="button"
              onClick={handleToggle}
              className={`hidden lg:flex items-center gap-1.5 rounded-xl border border-sage-200 bg-white px-3 py-1.5 text-xs font-black text-teal-700 shadow-xs transition hover:bg-sage-50 hover:scale-105 active:scale-95 ${
                isCollapsed ? "ring-2 ring-teal-500/30" : ""
              }`}
              title={isCollapsed ? "Buka Panel Menu Kiri" : "Tutup Panel Menu Kiri"}
            >
              <span className="text-sm">{isCollapsed ? "☰" : "◀"}</span>
              <span>{isCollapsed ? "Buka Panel" : "Tutup"}</span>
            </button>

            {headerLogo}
            <span className="hidden text-sm font-bold text-softslate/40 sm:inline">/</span>
            <span className="hidden text-sm font-black text-teal-700 sm:inline">
              {headerTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">{headerRight}</div>
        </header>

        <main className={`mx-auto px-4 py-6 sm:px-6 sm:py-8 transition-all ${isCollapsed ? "max-w-7xl" : "max-w-5xl"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
