"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type idDict from "@/lib/i18n/id.json";

type Dict = typeof idDict;

export function ResetPasswordButton({
  email,
  name,
  dict,
}: {
  email: string;
  name: string;
  dict: Dict;
}) {
  const t = dict.admin;
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (sending) return;

    if (
      !window.confirm(
        `${t.reset_confirm_prefix} "${name || email}"${t.reset_confirm_suffix}`,
      )
    ) {
      return;
    }

    setSending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        alert(`${t.error_prefix} ${error.message}`);
      } else {
        alert(
          `${t.reset_success_prefix} ${email}${t.reset_success_suffix}`,
        );
      }
    } catch {
      alert(t.connection_error);
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSend()}
      disabled={sending}
      className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
      title={t.reset_title}
    >
      {sending ? "..." : t.reset_btn}
    </button>
  );
}