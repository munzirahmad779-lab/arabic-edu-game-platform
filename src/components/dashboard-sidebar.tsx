"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/dictionaries";
import { DashboardHealthIndicator } from "@/components/dashboard-health-indicator";

type SidebarDict = {
  group_data: string;
  group_activity: string;
  group_other: string;
  nav_dashboard: string;
  nav_classes: string;
  nav_students: string;
  nav_games: string;
  nav_question_banks: string;
  nav_assessments: string;
  nav_reports: string;
  nav_account: string;
  nav_audio: string;
  nav_admin: string;
  menu_open: string;
  menu_close: string;
};

type MenuItem = {
  href: string;
  labelKey: keyof SidebarDict;
  icon: string;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export function DashboardSidebar({
  locale,
  dict,
  brandName,
  isSuperAdmin,
}: {
  locale: Locale;
  dict: SidebarDict;
  brandName: string;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isRtl = locale === "ar";

  const dataItems: MenuItem[] = [
    { href: "/dashboard", labelKey: "nav_dashboard", icon: "🏠" },
    { href: "/dashboard/classes", labelKey: "nav_classes", icon: "🏫" },
    { href: "/dashboard/students", labelKey: "nav_students", icon: "👥" },
  ];

  const activityItems: MenuItem[] = [
    { href: "/dashboard/games", labelKey: "nav_games", icon: "🎮" },
    {
      href: "/dashboard/question-banks",
      labelKey: "nav_question_banks",
      icon: "❓",
    },
    { href: "/dashboard/assessments", labelKey: "nav_assessments", icon: "📝" },
    { href: "/dashboard/reports", labelKey: "nav_reports", icon: "📊" },
  ];

  const otherItems: MenuItem[] = [
    { href: "/dashboard/account", labelKey: "nav_account", icon: "⚙️" },
    { href: "/dashboard/settings/audio", labelKey: "nav_audio", icon: "🎵" },
  ];

  if (isSuperAdmin) {
    otherItems.push({
      href: "/dashboard/admin",
      labelKey: "nav_admin",
      icon: "🛡️",
    });
  }

  const menu = (
    <>
      {/* Logo (tetap) */}
      <div className="border-b border-sage-200/60 px-5 py-5">
        <Link
          href="/dashboard"
          onClick={() => setOpen(false)}
          className="flex items-center"
          aria-label={brandName}
        >
          <Image
            src="/logo-horizontal.png"
            alt={brandName}
            width={200}
            height={88}
            className="h-9 w-auto"
            priority
          />
        </Link>
        <p className="mt-2 text-[10px] font-bold tracking-wide text-softslate/60">
          Belajar • Bermain • Berkembang
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Quick Launcher: Proyektor & Remote */}
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-3 text-white shadow-md">
          <div className="flex items-center gap-2 text-xs font-black">
            <span>📽️</span>
            <span>Mode Proyektor</span>
          </div>
          <p className="mt-1 text-[10px] text-emerald-100">
            Layar smartboard + stik HP nirkabel siswa.
          </p>
          <div className="mt-2 flex gap-1.5">
            <Link
              href="/test-projector"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg bg-white/20 py-1 text-center text-[10px] font-black text-white hover:bg-white/30 transition"
            >
              Layar TV
            </Link>
            <a
              href="/controller"
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg bg-white py-1 text-center text-[10px] font-black text-emerald-900 hover:bg-emerald-50 transition"
            >
              Stik HP 🎮
            </a>
          </div>
        </div>

        <MenuGroup
          label={dict.group_data}
          items={dataItems}
          dict={dict}
          pathname={pathname}
          onLink={() => setOpen(false)}
        />
        <MenuGroup
          label={dict.group_activity}
          items={activityItems}
          dict={dict}
          pathname={pathname}
          onLink={() => setOpen(false)}
        />
        <MenuGroup
          label={dict.group_other}
          items={otherItems}
          dict={dict}
          pathname={pathname}
          onLink={() => setOpen(false)}
        />
      </nav>
      <DashboardHealthIndicator />
    </>
  );

  return (
    <>
      {/* Hamburger (mobile) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed top-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-sage-200 bg-white text-lg font-black text-teal-700 shadow-lg transition hover:bg-sage-50 lg:hidden"
        style={{ insetInlineStart: "1rem" }}
        aria-label={open ? dict.menu_close : dict.menu_open}
      >
        {open ? "✕" : "☰"}
      </button>

      {/* Sidebar desktop (fixed) */}
      <aside
        className="hidden lg:flex fixed inset-y-0 z-30 w-60 flex-col border-e border-sage-200/60 bg-white"
        style={{ insetInlineStart: 0 }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {menu}
      </aside>

      {/* Drawer mobile */}
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed inset-y-0 z-50 flex w-64 flex-col border-e border-sage-200/60 bg-white shadow-2xl lg:hidden"
            style={{ insetInlineStart: 0 }}
            dir={isRtl ? "rtl" : "ltr"}
          >
            {menu}
          </aside>
        </>
      ) : null}
    </>
  );
}

function MenuGroup({
  label,
  items,
  dict,
  pathname,
  onLink,
}: {
  label: string;
  items: MenuItem[];
  dict: SidebarDict;
  pathname: string;
  onLink: () => void;
}) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-wider text-softslate/50">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onLink}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-terracotta-100 text-terracotta-700"
                    : "text-softslate hover:bg-sage-50 hover:text-teal-700"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="truncate">{dict[item.labelKey]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}