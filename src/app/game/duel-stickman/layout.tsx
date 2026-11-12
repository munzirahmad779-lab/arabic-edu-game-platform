import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";

/**
 * Duel Stickman Berpedang hanya untuk guru yang sudah masuk (pola yang
 * sama seperti game mandiri lain di /game: sesi diperiksa di server,
 * tamu diarahkan ke /login).
 */
export default async function DuelStickmanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
