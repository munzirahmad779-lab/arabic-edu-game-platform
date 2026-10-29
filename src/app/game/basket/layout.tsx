import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";

/**
 * Basket Pengetahuan hanya untuk guru yang sudah masuk, sama seperti
 * game mandiri lain di /game: sesi diperiksa di server, tamu diarahkan
 * ke /login.
 */
export default async function BasketLayout({
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
