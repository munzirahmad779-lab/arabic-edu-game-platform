/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pisahkan folder hasil build dev (.next) dan produksi (.next-prod) agar
  // "next dev" dan "next start" bisa jalan bersamaan tanpa saling menimpa.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },

  // Type-check & lint WAJIB lulus saat build (baseline terverifikasi bersih
  // 10 Nov 2026: typecheck 0 error, lint 0 error). Jangan matikan lagi tanpa
  // mencatat alasan dan tanggal di sini.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  images: {
    formats: ["image/avif", "image/webp"],
  },

  productionBrowserSourceMaps: false,

  // Header keamanan global. CSP sengaja konservatif: hanya membatasi
  // framing, objek/plugin, dan base-uri. script-src/style-src TIDAK dikunci
  // di sini karena Next 14 memakai inline script/style (nonce belum dipasang);
  // menguncinya tanpa nonce akan mematahkan aplikasi.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },

  // Mode Guest sudah dihilangkan: /guest wajib menjadi redirect HTTP
  // sungguhan ke /login di level server (bukan hanya redirect komponen),
  // supaya tautan lama yang dibuka non-browser pun teralihkan dengan benar.
  async redirects() {
    return [
      {
        source: "/guest",
        destination: "/login",
        permanent: false,
      },
      // Game mandiri Duel Stickman Berpedang di public/duel-stickman:
      // URL bersih /duel-stickman membuat rujukan relatif "assets/..."
      // di dalam berkas game terurai ke /assets/... (404, gambar
      // pendekar dan arena tidak termuat). Alihkan ke berkas nyatanya
      // supaya URL dokumen selalu berada di dalam folder game itu.
      {
        source: "/duel-stickman",
        destination: "/duel-stickman/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;