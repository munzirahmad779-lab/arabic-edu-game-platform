import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sigetteng-Getteng — Tarik Tambang Pengetahuan",
  description:
    "Game tarik tambang pengetahuan hot-seat satu perangkat: DUEL 1v1 dan SQUAD 2v2 dengan maskot Tarsius, Anoa, Maleo, dan Yaki. Bahasa Arab, Matematika, Biologi, dan Fisika SMA.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-rose-400 pl-3 text-lg font-black text-slate-900">{children}</h2>
);

export default function SigettengGettengLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
        Sigetteng-Getteng — Tarik Tambang Pengetahuan
      </h1>
      <p className="mt-3 text-slate-600">
        Dua tim, satu tali, satu bank soal. Maskot Sulawesi — Tarsius, Anoa, Maleo, dan Yaki — saling
        tarik: jawab benar, talimu tertarik; makin kuat jawaban beruntunmu, makin jauh tarikannya.
        Bahasa Arab, Matematika, Biologi, dan Fisika dalam satu arena.
      </p>

      <Link
        href="/game/sigetteng-getteng/play"
        className="mt-6 inline-block rounded-2xl bg-rose-400 px-8 py-4 text-xl font-black text-slate-950 shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <H>FORMAT BERMAIN: SATU PERANGKAT (HOT-SEAT)</H>
      <p className="mt-2 text-slate-700">
        Game ini dimainkan bersama di <strong>satu perangkat yang sama</strong>: 2 pemain (DUEL 1 lawan 1)
        atau 4 pemain (SQUAD 2 lawan 2) bergantian menjawab di panelnya masing-masing pada layar yang
        sama. Ini <strong>bukan permainan online</strong> — tidak ada room, kode gabung, atau lawan dari
        perangkat lain. Paling pas dimainkan di layar interaktif kelas (IFP/Smartboard), proyektor, atau
        satu ponsel/tablet yang dipakai bergantian.
      </p>

      <H>TARGET AUDIENS</H>
      <p className="mt-2 text-slate-700">
        Siswa SMA kelas X–XII (Bahasa Arab, Matematika, Biologi, Fisika) serta guru yang memakai layar
        bersama di kelas untuk drill materi menjelang ulangan. Setiap pertandingan berlangsung 3 menit.
      </p>

      <H>CARA BERMAIN</H>
      <ol className="mt-2 list-decimal pl-6 text-slate-700">
        <li>Pilih format tanding: DUEL (1 lawan 1) atau SQUAD (2 lawan 2).</li>
        <li>Pilih mata pelajaran, lalu tunggu hitung mundur 3-2-1.</li>
        <li>Setiap panel menampilkan soal dan empat pilihan jawaban untuk pemain di panel itu.</li>
        <li>
          Jawaban benar menambah kekuatan tim (mulai dari 3, maksimum 10; menjawab dalam 5 detik memberi
          bonus) dan menarik tali sebesar 12 + 4 × kekuatan.
        </li>
        <li>Jawaban salah tidak menghukum tali; soal yang tidak dijawab dalam 12 detik mengurangi kekuatan.</li>
        <li>Menang bila geseran tali mencapai 85, atau bila waktu 3 menit habis dan talinya berada di sisimu.</li>
      </ol>

      <H>BANK SOAL GURU & PAPAN SKOR LOKAL</H>
      <p className="mt-2 text-slate-700">
        Di dalam game tersedia menu bank soal: guru dapat menambah dan menghapus soal, mengimpor soal
        dari CSV, dan mengembalikan bank ke bawaan. Bank soal, papan skor (50 hasil terakhir), dan
        pengaturan tersimpan <strong>secara lokal di perangkat yang dipakai bermain</strong> (penyimpanan
        browser perangkat itu), bukan di server Magguru — jadi bank dan skor tidak berpindah antarperangkat.
      </p>

      <H>MAIN SEKARANG</H>
      <p className="mt-2 text-slate-700">
        Tidak perlu instalasi atau akun. Tekan tombol di bawah, pilih mode, dan mulai bertanding.
      </p>
      <Link
        href="/game/sigetteng-getteng/play"
        className="mt-4 inline-block rounded-2xl bg-slate-900 px-8 py-4 text-lg font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>
    </main>
  );
}
