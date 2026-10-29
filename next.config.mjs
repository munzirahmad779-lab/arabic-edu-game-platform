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

  // ⚡ Percepat build: skip type-check & lint saat build.
  // VS Code tetap cek tipe saat Anda ngoding.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    formats: ["image/avif", "image/webp"],
  },

  productionBrowserSourceMaps: false,

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
    ];
  },
};

export default nextConfig;