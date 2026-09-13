"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
export default function JoinRoomRefresh({ token }: { token: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const timer = window.setInterval(async () => {
      const { data } = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).rpc("get_join_session", { p_join_token: token });
      if (data?.[0]) router.refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [router, token]);
  return null;
}
