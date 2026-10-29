import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Perang Antariksa — Tembak Asteroid Soal",
  description:
    "Game bertahan dari asteroid soal hot-seat satu perangkat: SOLO, DUEL, TRIO, dan QUAD dengan keypad angka dan pilihan jawaban per lajur.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-teal-500 pl-3 text-lg font-black text-slate-900">{children}</h2>
);

export default function SpaceWarLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
        Perang Antariksa — Tembak Asteroid Soal
      </h1>
      <p className="mt-3 text-slate-600">
        Asteroid membawa soal meluncur menuju garis pertahananmu. Untuk soal
        angka, ketik jawaban di keypad lajurmu; untuk soal biasa, pilih
        jawabannya. Jawaban benar menembak asteroid itu sebelum menembus
        garis.
      </p>

      <Link
        href="/game/space-war/play"
        className="mt-6 inline-block rounded-2xl bg-teal-600 px-8 py-4 text-xl font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <H>FORMAT BERMAIN: SATU PERANGKAT (HOT-SEAT)</H>
      <p className="mt-2 text-slate-700">
        Game ini dimainkan bersama di <strong>satu perangkat yang sama</strong>:
        sendiri (SOLO) atau 2 sampai 4 pemain (DUEL, TRIO, QUAD), tiap pemain
        di lajurnya sendiri pada layar yang sama. Ini{" "}
        <strong>bukan permainan online</strong> — tidak ada room atau kode
        gabung. Paling pas di layar interaktif kelas, proyektor, atau satu
        tablet bersama.
      </p>

      <H>SUMBER SOAL</H>
      <p className="mt-2 text-slate-700">
        Selain bank bawaan dan bank buatan sendiri, game ini bisa mengambil
        soal langsung dari <strong>Bank Soal LMS</strong>: buka Bank Soal di
        dalam game, pilih bank pada panel &quot;Ambil dari Bank Soal
        LMS&quot;, dan soal bank itu menjadi isi Mapel Guru yang siap
        dimainkan.
      </p>
    </main>
  );
}
