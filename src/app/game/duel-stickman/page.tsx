import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Duel Stickman Berpedang",
  description:
    "Game duel pedang stickman maskot Sulawesi: jawab 5 soal untuk meramu kekuatan, lalu bertarung 90 detik. Main di satu layar, atau layar guru menjadi tuan rumah dan HP menjadi kontroler. Soal dari bank bawaan, bank lokal guru, atau Bank Soal LMS.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-teal-600 pl-3 text-lg font-black text-slate-900">{children}</h2>
);

export default function DuelStickmanLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
      >
        ← Kembali ke Dashboard
      </Link>

      <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
        Duel Stickman Berpedang
      </h1>
      <p className="mt-3 text-slate-600">
        Lima pendekar stickman bermaskot satwa Sulawesi (Tarsius, Anoa, Maleo, Yaki, dan
        Kuskus) berduel pedang di arena sore. Sebelum bertarung, tiap pemain menjawab 5 soal
        untuk meramu kekuatannya: jawaban benar memberi power up, jawaban salah memberi power
        down, dan jurus khas pendekar terbuka bila minimal 3 jawaban benar. Duelnya sendiri
        berjalan 90 detik.
      </p>

      <Link
        href="/game/duel-stickman/play"
        className="mt-6 inline-block rounded-2xl bg-teal-700 px-8 py-4 text-xl font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <H>FORMAT BERMAIN: LAYAR INI, TUAN RUMAH, DAN KONTROLER HP</H>
      <p className="mt-2 text-slate-700">
        Satu game membawa tiga peran layar. <strong>Main di Layar Ini</strong>: sendiri melawan
        komputer atau berdua di layar yang sama, tanpa jaringan.{" "}
        <strong>Layar Tuan Rumah</strong>: layar besar menampilkan arena dan membuat kode
        gabung 4 karakter; hingga dua HP bergabung sebagai kontroler Pemain 1 dan Pemain 2
        lewat relai internet. <strong>Kontroler HP</strong>: HP hanya mengirim keadaan tombol
        (tekan, tahan, lepas). Pilih pendekar dan fase soal tetap dikerjakan di layar utama,
        jadi game ini paling pas dimainkan di proyektor atau layar interaktif kelas dengan
        perangkat guru sebagai layarnya.
      </p>

      <H>TARGET AUDIENS</H>
      <p className="mt-2 text-slate-700">
        Siswa yang berlatih kosakata Arab, hitung cepat, dan pengetahuan umum lewat bank
        bawaan, serta guru yang ingin memakai soalnya sendiri, baik dari bank lokal game
        maupun dari menu Bank Soal LMS (misalnya bank Dars atau bank campuran yang sudah
        dibuat untuk permainan kelas lain).
      </p>

      <H>CARA BERMAIN</H>
      <ol className="mt-2 list-decimal pl-6 text-slate-700">
        <li>Pilih peran layar, mode (Lawan Komputer atau Dua Pemain), kategori soal, lalu pendekar.</li>
        <li>Jawab 5 soal per pemain: tiap jawaban benar memberi satu power up, tiap jawaban salah memberi satu power down. Jurus terbuka bila minimal 3 benar.</li>
        <li>Tekan Mulai Duel, lalu gerak, lompat, tebas, dan tangkis. Tangkisan memotong damage biasa menjadi 25% dan menahan dorongan, tetapi tidak menahan jurus.</li>
        <li>Menang dengan menghabiskan HP lawan (KO) atau memegang HP tertinggi saat 90 detik habis.</li>
        <li>
          Salah pilih tidak mengunci permainan: ada tombol kembali di layar pilih pendekar,
          di tengah kuis, di tengah duel, dan di layar hasil.
        </li>
      </ol>

      <H>BANK SOAL: BAWAAN, BANK LOKAL GURU, DAN BANK SOAL LMS</H>
      <p className="mt-2 text-slate-700">
        Game membawa 15 soal bawaan dalam 3 kategori. Tombol <strong>Kelola Soal</strong> di
        layar awal membuka bank lokal game: tambah, sunting, dan hapus soal lewat formulir,
        impor dan ekspor massal satu soal per baris, serta atur ulang ke soal bawaan. Di
        halaman main tersedia panel <strong>Ambil dari Bank Soal LMS</strong>: bank milik guru
        yang dipilih di panel itu terpasang sebagai kategori soal di dalam game dan bisa
        dipilih di layar pilih pendekar. Bank lokal dan bank LMS yang terpasang tersimpan{" "}
        <strong>secara lokal di perangkat yang dipakai bermain</strong> (penyimpanan browser
        perangkat itu), bukan di server Magguru, jadi keduanya tidak berpindah antarperangkat.
      </p>

      <H>MAIN SEKARANG</H>
      <p className="mt-2 text-slate-700">
        Tekan tombol di bawah, pilih peran dan pendekar, jawab soalnya, lalu mulai duelnya.
      </p>
      <Link
        href="/game/duel-stickman/play"
        className="mt-4 inline-block rounded-2xl bg-slate-900 px-8 py-4 text-lg font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>
    </main>
  );
}
