"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/dictionaries";

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
      <Link
        href="/dashboard"
        onClick={() => setOpen(false)}
        className="flex items-center justify-center border-b border-sage-200/60 px-4 py-4"
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

      <nav className="flex-1 overflow-y-auto px-3 py-4">
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

      <div className="border-t border-sage-200/60 p-3 text-center text-[10px] text-softslate/50">
        Magguru © 2026
      </div>
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
      <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-wider text-softslate/60">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onLink}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-terracotta-500 text-white shadow-sm"
                    : "text-teal-700 hover:bg-sage-50"
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