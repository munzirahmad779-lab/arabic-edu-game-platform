import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Adu Tarik Cerdas SMA — Game Tarik Tambang Pengetahuan",
  description:
    "Game edukasi adu tarik tambang pengetahuan untuk SMA: Bahasa Arab, Matematika, Biologi, dan Fisika. Mode DUEL 1v1 dan SQUAD 2v2, timer 3 menit, papan skor lokal.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-amber-400 pl-3 text-lg font-black text-slate-900">{children}</h2>
);

export default function AduTarikLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
        Adu Tarik Cerdas SMA — Tarik Tambang Pengetahuan
      </h1>
      <p className="mt-3 text-slate-600">
        Dua tim, satu tali, satu bank soal. Jawab benar → tali tertarik ke sisimu. Jawab salah → tim lawan
        mengambil alih. Bahasa Arab, Matematika, Biologi, dan Fisika dalam satu arena.
      </p>

      <Link
        href="/game/adu-tarik-dino/play"
        className="mt-6 inline-block rounded-2xl bg-amber-400 px-8 py-4 text-xl font-black text-slate-950 shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <H>TARGET AUDIENS</H>
      <p className="mt-2 text-slate-700">
        Siswa SMA kelas X–XII (Nahwu, shorof, kosakata Arab, turunan, trigonometri, sitologi, genetika,
        termodinamika) serta guru yang memakai layar interaktif (IFP/Smartboard) di kelas. Nyaman dipakai
        berdua di satu layar besar maupun di ponsel dengan panel bersebelahan.
      </p>

      <H>KONTEKS EDUKASI</H>
      <p className="mt-2 text-slate-700">
        Dibuat untuk pengulangan materi (drill) menjelang ulangan: tiap pertandingan berlangsung 3 menit,
        soal berulang dengan variasi, sehingga siswa mengulang konsep yang sama puluhan kali tanpa bosan.
        Pemilihan mata pelajaran memisahkan empat rumpun materi kurikulum SMA.
      </p>

      <H>FOKUS BELAJAR</H>
      <ul className="mt-2 list-disc pl-6 text-slate-700">
        <li>Bahasa Arab: kedudukan kata (mubtada&apos;/khabar), antonim, jamak taksir, tanda i&apos;rab.</li>
        <li>Matematika: turunan, trigonometri, determinan matriks.</li>
        <li>Biologi: organel sel, pembelahan meiosis, enzim pencernaan.</li>
        <li>Fisika: satuan SI, hukum termodinamika.</li>
        <li>Ketepatan dan kecepatan mengambil keputusan secara berkelompok.</li>
      </ul>

      <H>CARA BERMAIN</H>
      <ol className="mt-2 list-decimal pl-6 text-slate-700">
        <li>Pilih format tanding: DUEL (1 lawan 1) atau SQUAD (2 lawan 2).</li>
        <li>Pilih mata pelajaran, lalu tunggu hitung mundur 3-2-1.</li>
        <li>Pada arena, waktu berjalan dari 03:00. Setiap panel tim menampilkan soal dan empat opsi.</li>
        <li>Ketuk jawaban benar: timmu menarik tali 25 px dan mendapat 10 poin.</li>
        <li>Jawaban salah tidak menggeser tali; karakter tampak goyah dan tombol bergetar.</li>
        <li>Menang bila pita penanda melewati garis batas lawan, atau bila waktu habis dengan posisi tali
          terjauh di sisimu.</li>
      </ol>

      <H>MANFAAT PEMBELAJARAN</H>
      <p className="mt-2 text-slate-700">
        Mendorong pengambilan keputusan cepat berbasis pengetahuan, memperkuat hafalan kaidah dan istilah,
        melatih kerja sama tim (SQUAD), serta memberi umpan balik langsung: benar/salah, poin, dan posisi
        tali. Papan skor lokal menyimpan riwayat juara sehingga guru bisa memantau hasil sesi kelas.
      </p>

      <H>MAIN SEKARANG</H>
      <p className="mt-2 text-slate-700">
        Tidak perlu instalasi atau akun. Tekan tombol di bawah, pilih mode, dan mulai bertanding.
      </p>
      <Link
        href="/game/adu-tarik-dino/play"
        className="mt-4 inline-block rounded-2xl bg-slate-900 px-8 py-4 text-lg font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <p className="mt-10 text-xs text-slate-500">
        Animasi: tarikan tali sinusoidal, dust burst saat jawaban benar, confetti saat menang — dibuat khusus,
        bukan salinan dari situs mana pun.
      </p>
    </main>
  );
}
