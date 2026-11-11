import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Maccule Ludo — Ludo Soal",
  description:
    "Game Ludo soal hot-seat satu perangkat: jawab benar untuk melempar dadu, keluar kandang dengan angka 6, tangkap pion lawan, dan balapan ke FINISH. SOLO lawan bot, DUEL, TRIO, dan QUAD dengan maskot Maleo, Tarsius, Anoa, dan Kuskus.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-teal-600 pl-3 text-lg font-black text-slate-900">{children}</h2>
);

export default function LudoAngkaLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
      >
        ← Kembali ke Dashboard
      </Link>

      <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
        Maccule Ludo — Ludo Soal
      </h1>
      <p className="mt-3 text-slate-600">
        Ludo di papan 15x15 yang setiap lemparan dadunya dibeli dengan jawaban benar. Keluar
        kandang hanya dengan angka 6, pion lawan yang tertangkap pulang ke kandang, dan FINISH
        harus dicapai dengan langkah pas. Satu pion per pemain, maskotnya Maleo, Tarsius, Anoa,
        dan Kuskus.
      </p>

      <Link
        href="/game/ludo-angka/play"
        className="mt-6 inline-block rounded-2xl bg-teal-700 px-8 py-4 text-xl font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <H>FORMAT BERMAIN: SATU PERANGKAT (HOT-SEAT)</H>
      <p className="mt-2 text-slate-700">
        Game ini dimainkan bersama di <strong>satu perangkat yang sama</strong>: SOLO melawan bot
        Tarsius, DUEL 2 pemain, TRIO 3 pemain, atau QUAD 4 pemain, bergantian menjawab dan melempar
        dadu di layar yang sama. Ini <strong>bukan permainan online</strong>: tidak ada room, kode
        gabung, atau kontroler HP pada versi LMS ini. Paling pas dimainkan di layar interaktif
        kelas (IFP/Smartboard), proyektor, atau satu ponsel/tablet yang dipakai bergantian.
      </p>

      <H>TARGET AUDIENS</H>
      <p className="mt-2 text-slate-700">
        Siswa yang berlatih Bahasa Indonesia, Bahasa Arab, Bahasa Inggris, Matematika, Biologi, dan
        Fisika lewat bank soal bawaan (bank yang sama dengan Mallaleng Angka), serta guru yang ingin
        memakai bank soalnya sendiri (Mapel Guru) atau bank dari menu Bank Soal LMS. Setiap
        pertandingan dibatasi 15 menit.
      </p>

      <H>CARA BERMAIN</H>
      <ol className="mt-2 list-decimal pl-6 text-slate-700">
        <li>Pilih mode (SOLO, DUEL, TRIO, QUAD) dan mata pelajaran, lalu tekan Mulai Main.</li>
        <li>Pemain pada gilirannya menjawab soal: benar berarti melempar dadu; salah berarti soal dilempar ke pemain berikutnya untuk direbut.</li>
        <li>Pion baru keluar dari kandang bila dadu menunjukkan angka 6; dadu 6, tangkapan, dan kotak bintang memberi lemparan bonus lewat soal bonus.</li>
        <li>
          Mendarat tepat di kotak pion lawan mengirim pion itu pulang ke kandang, kecuali di
          kotak aman: 4 kotak start dan 4 kotak bintang.
        </li>
        <li>Kotak tercetak lain: Kilat maju 4 langkah, Mundur kembali 4 langkah, dan Berhenti membuat pemain melewati satu giliran.</li>
        <li>
          Menang bila mencapai FINISH di langkah 57 dengan angka pas (kelebihan memantul mundur),
          atau bila waktu 15 menit habis dan kemajuannya tertinggi (seri diputuskan oleh jumlah
          jawaban benar terbanyak).
        </li>
      </ol>

      <H>BANK SOAL: BAWAAN, MAPEL GURU, DAN BANK SOAL LMS</H>
      <p className="mt-2 text-slate-700">
        Di dalam game tersedia menu Bank Soal: enam mapel bawaan berisi 10 soal masing-masing, guru
        dapat menambah dan menghapus soal, mengimpor soal massal berformat Markdown atau CSV, dan
        memasang bank dari menu <strong>Bank Soal LMS</strong> lewat panel &quot;Ambil dari Bank
        Soal LMS&quot;. Bank lokal dan papan skor (50 hasil terakhir) tersimpan{" "}
        <strong>secara lokal di perangkat yang dipakai bermain</strong> (penyimpanan browser
        perangkat itu), bukan di server Magguru, jadi bank lokal dan skor tidak berpindah
        antarperangkat.
      </p>

      <H>MAIN SEKARANG</H>
      <p className="mt-2 text-slate-700">
        Tekan tombol di bawah, pilih mode dan mapel, lalu mulai balapan ke FINISH.
      </p>
      <Link
        href="/game/ludo-angka/play"
        className="mt-4 inline-block rounded-2xl bg-slate-900 px-8 py-4 text-lg font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>
    </main>
  );
}
