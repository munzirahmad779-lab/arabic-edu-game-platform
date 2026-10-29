import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Basket Pengetahuan — Lempar Bola Jawaban",
  description:
    "Game basket pengetahuan hot-seat satu perangkat: dua tim menjawab soal lalu melempar bola ke ring. Bahasa Arab, Matematika, Biologi, Fisika, dan Mapel Guru.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-teal-500 pl-3 text-lg font-black text-slate-900">{children}</h2>
);

export default function BasketLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">
        Basket Pengetahuan — Lempar Bola Jawaban
      </h1>
      <p className="mt-3 text-slate-600">
        Dua tim, dua panel soal, satu lapangan. Jawab soal di panelmu untuk
        membuka lemparan: arahkan dan lempar bola ke ring untuk mencetak poin.
        Maskot Sulawesi — Tarsius, Anoa, Maleo, dan Yaki — membela timmu.
      </p>

      <Link
        href="/game/basket/play"
        className="mt-6 inline-block rounded-2xl bg-teal-600 px-8 py-4 text-xl font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <H>FORMAT BERMAIN: SATU PERANGKAT (HOT-SEAT)</H>
      <p className="mt-2 text-slate-700">
        Game ini dimainkan bersama di <strong>satu perangkat yang sama</strong>:
        dua tim bergantian menjawab di panelnya masing-masing pada layar yang
        sama. Ini <strong>bukan permainan online</strong> — tidak ada room,
        kode gabung, atau lawan dari perangkat lain. Paling pas dimainkan di
        layar interaktif kelas (IFP/Smartboard), proyektor, atau satu
        ponsel/tablet yang dipakai bergantian.
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
