"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordButton({
  email,
  name,
}: {
  email: string;
  name: string;
}) {
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (sending) return;

    if (
      !window.confirm(
        `إرسال رابط إعادة تعيين كلمة المرور إلى "${name || email}"؟\nسيستلم المعلم رسالة على بريده.`,
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
        alert(`خطأ: ${error.message}`);
      } else {
        alert(
          `✓ تم إرسال رابط إعادة التعيين إلى ${email}.\nاطلب من المعلم التحقق من بريده.`,
        );
      }
    } catch {
      alert("تعذر الاتصال بالخادم.");
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
      title="إرسال رابط إعادة تعيين كلمة المرور"
    >
      {sending ? "..." : "🔑 إعادة تعيين"}
    </button>
  );
}