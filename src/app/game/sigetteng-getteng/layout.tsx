import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/auth";

/**
 * Sigetteng-Getteng hanya untuk guru yang sudah masuk (keputusan pemilik:
 * game mandiri ini tidak dibuka publik, berbeda dari dua game mandiri lama
 * yang memang dirancang terbuka). Pola penjaga sama seperti layout
 * /dashboard: sesi diperiksa di server, tamu diarahkan ke /login.
 */
export default async function SigettengGettengLayout({
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
