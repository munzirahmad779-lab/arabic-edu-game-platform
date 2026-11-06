"use client";

import dynamic from "next/dynamic";

// ---------------------------------------------------------------------------
// Pemuat tangguh untuk keenam pemain arkade proyektor (Pesawat Awan, Pukul
// Tikus, Penjaga Antariksa, Kartu Memori, Balon Jawaban, Roda Putar).
//
// Riwayat masalah: pemain dimuat dengan next/dynamic tanpa penanda muat dan
// tanpa penanganan galat. Bila impor chunk gagal atau tidak kunjung selesai
// (kasus nyata: tab proyektor yang tetap terbuka melewati deploy baru,
// sehingga runtime lama meminta nama chunk yang sudah tidak ada di
// deployment terbaru), React menampilkan fallback kosong dan panggung
// menjadi hitam total selamanya: header tampil, isi panggung hilang, tanpa
// pesan apa pun dan tanpa jalan pulih selain guru menebak harus memuat
// ulang halaman secara manual.
//
// Perilaku kini:
// 1. Selama chunk diambil, panggung menampilkan penanda "Memuat permainan"
//    (bukan kekosongan), khusus di area panggung; header tidak berubah.
// 2. Impor yang gagal dicoba lagi sampai 3 kali dengan jeda bertingkat.
// 3. Bila tetap gagal, halaman dimuat ulang SEKALI (penjaga sessionStorage
//    per pemain, jadi tidak berputar tanpa henti) agar peramban mengambil
//    HTML dan peta chunk build terbaru. Sesudah penjaga terpakai, galat
//    diteruskan ke batas galat aplikasi yang menyediakan tombol coba lagi.
// 4. projector-screen memanggil prefetchPemainArkade() saat lobi tampil,
//    sehingga chunk biasanya sudah ada di memori sebelum guru memilih mode.
// ---------------------------------------------------------------------------

const KUNCI_PENJAGA = "arkade-muat-ulang-";

async function imporTangguh<T>(muat: () => Promise<T>, nama: string): Promise<T> {
  const kunci = KUNCI_PENJAGA + nama;
  let galatTerakhir: unknown = null;
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    try {
      const hasil = await muat();
      try {
        sessionStorage.removeItem(kunci);
      } catch {
        // sessionStorage tidak tersedia: abaikan, pemuatan tetap berhasil.
      }
      return hasil;
    } catch (galat) {
      galatTerakhir = galat;
      await new Promise((tunggu) => setTimeout(tunggu, 500 * (percobaan + 1)));
    }
  }
  // Diduga chunk basi sesudah deploy: satu kali muat ulang penuh untuk
  // mengambil build terbaru. Penjaga mencegah lingkaran muat ulang.
  try {
    if (!sessionStorage.getItem(kunci)) {
      sessionStorage.setItem(kunci, "1");
      window.location.reload();
    }
  } catch {
    // Abaikan: galat asli tetap diteruskan di bawah.
  }
  throw galatTerakhir;
}

function PanggungArkadeMemuat({ label }: { label: string }) {
  return (
    <div className="relative w-full h-[580px] bg-slate-900 rounded-3xl overflow-hidden border-2 border-white/15 flex flex-col items-center justify-center gap-4 text-white select-none">
      <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-sky-400 animate-spin" />
      <p className="text-sm font-black tracking-wide">Memuat {label}…</p>
      <p className="text-[11px] text-white/60 font-semibold px-6 text-center">
        Mengambil berkas permainan. Bila tampilan ini tidak berubah, periksa koneksi internet lalu muat ulang halaman.
      </p>
    </div>
  );
}

const muatAirplane = () =>
  import("@/components/game-players/airplane-player").then((mod) => mod.AirplanePlayer);
const muatWhack = () =>
  import("@/components/game-players/whack-player").then((mod) => mod.WhackPlayer);
const muatSpace = () =>
  import("@/components/game-players/space-defender-player").then((mod) => mod.SpaceDefenderPlayer);
const muatMemory = () =>
  import("@/components/game-players/memory-player").then((mod) => mod.MemoryPlayer);
const muatBalloon = () =>
  import("@/components/game-players/balloon-player").then((mod) => mod.BalloonPlayer);
const muatWheel = () =>
  import("@/components/game-players/wheel-player").then((mod) => mod.WheelPlayer);

export const AirplanePlayer = dynamic(() => imporTangguh(muatAirplane, "airplane"), {
  ssr: false,
  loading: () => <PanggungArkadeMemuat label="Pesawat Terbang Awan" />,
});
export const WhackPlayer = dynamic(() => imporTangguh(muatWhack, "whack"), {
  ssr: false,
  loading: () => <PanggungArkadeMemuat label="Pukul Tikus Kosakata" />,
});
export const SpaceDefenderPlayer = dynamic(() => imporTangguh(muatSpace, "space"), {
  ssr: false,
  loading: () => <PanggungArkadeMemuat label="Penjaga Antariksa" />,
});
export const MemoryPlayer = dynamic(() => imporTangguh(muatMemory, "memory"), {
  ssr: false,
  loading: () => <PanggungArkadeMemuat label="Kartu Memori Flip 3D" />,
});
export const BalloonPlayer = dynamic(() => imporTangguh(muatBalloon, "balloon"), {
  ssr: false,
  loading: () => <PanggungArkadeMemuat label="Pecahkan Balon Jawaban" />,
});
export const WheelPlayer = dynamic(() => imporTangguh(muatWheel, "wheel"), {
  ssr: false,
  loading: () => <PanggungArkadeMemuat label="Roda Putar" />,
});

// Memicu pengambilan keenam chunk sejak lobi tampil (tanpa memicu muat
// ulang bila gagal; jalur tangguh tetap dipakai saat mode benar dibuka).
export function prefetchPemainArkade(): void {
  for (const muat of [muatAirplane, muatWhack, muatSpace, muatMemory, muatBalloon, muatWheel]) {
    void muat().catch(() => {
      // Prefetch gagal tidak fatal: impor tangguh berjalan saat mode dibuka.
    });
  }
}
