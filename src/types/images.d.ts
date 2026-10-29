/// <reference types="next/image-types/global" />

// Deklarasi modul aset gambar untuk impor langsung dari src
// (dipakai modul Sigetteng-Getteng). Berkas ini membuat typecheck
// lulus pada checkout segar (CI) yang belum memiliki next-env.d.ts,
// yang biasanya dibuat otomatis oleh Next saat dev/build.
declare module "*.png" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.jpg" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.jpeg" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.webp" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.gif" {
  const src: import("next/image").StaticImageData;
  export default src;
}
