import { notFound } from "next/navigation";

// Halaman /lab adalah alat uji internal. Di produksi seluruh subtree ini
// wajib tidak ada (404), bukan hanya tidak ditautkan.
export default function LabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
