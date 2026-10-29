"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2>Terjadi kesalahan pada aplikasi</h2>
          <p style={{ color: "#666", fontSize: "0.875rem", maxWidth: "28rem" }}>{error?.message || "Silakan muat ulang halaman."}</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: "1rem", borderRadius: "0.375rem", backgroundColor: "#171717", padding: "0.5rem 1rem", fontSize: "0.875rem", color: "#fff", border: "none", cursor: "pointer" }}
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
