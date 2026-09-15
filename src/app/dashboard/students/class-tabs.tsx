"use client";

import { useState, type ReactNode } from "react";

type Tab = {
  key: string;
  label: string;
  icon: string;
  content: ReactNode;
};

export function ClassTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-2xl bg-neutral-100 p-1">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition ${
                isActive
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-neutral-600 hover:bg-white/60"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {tabs.map((t) => (
          <div
            key={t.key}
            className={t.key === active ? "block" : "hidden"}
          >
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}