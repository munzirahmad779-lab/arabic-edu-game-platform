/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;