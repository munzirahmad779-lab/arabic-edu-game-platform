import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Banua Fruit Blast — Petik Buah Jawaban Benar",
  description:
    "Game edukasi petik buah: jawab soal Bahasa Arab, Bahasa Inggris, dan Matematika dengan menangkap buah jawaban yang benar. Mode Solo, Duel, dan Squad untuk 1–4 pemain di satu layar.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-lime-400 pl-3 text-lg font-black text-emerald-950">{children}</h2>
);

export default function BanuaFruitBlastLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-700">Game Edukasi</p>
      <h1 className="mt-2 text-3xl font-black leading-tight text-emerald-950 sm:text-4xl">
        Banua Fruit Blast — Petik Buah Jawaban Benar
      </h1>
      <p className="mt-3 text-slate-700">
        Buah-buah jatuh dari atas arena, masing-masing membawa satu teks jawaban. Baca soal di panelmu, lalu
        ketuk buah yang memuat jawaban benar. Salah petik, poin berkurang. Satu layar untuk 1 sampai 4 pemain.
      </p>

      <Link
        href="/game/banua-fruit-blast/play"
        className="mt-6 inline-block rounded-2xl bg-lime-400 px-8 py-4 text-xl font-black text-emerald-950 shadow-lg transition active:scale-95"
        data-start="1"
      >
        MULAI
      </Link>

      <H>TARGET AUDIENS</H>
      <p className="mt-2 text-slate-700">
        Siswa SD dan SMP yang sedang menguatkan kosakata Bahasa Arab, kosakata Bahasa Inggris, serta
        aritmetika dasar. Juga cocok untuk guru yang memakai layar interaktif (IFP/Smartboard) di kelas:
        mode Duel dan Squad membagi arena menjadi dua atau empat lajur sehingga tiap siswa punya area sendiri.
      </p>

      <H>KONTEKS EDUKASI</H>
      <p className="mt-2 text-slate-700">
        Dirancang untuk pengulangan cepat (drill) di awal atau akhir pelajaran. Satu pertandingan berlangsung
        tiga menit, soal diacak ulang setiap sesi, dan peserta bisa memilih mata pelajaran serta jumlah soal
        sesuai kebutuhan kelas.
      </p>

      <H>FOKUS BELAJAR</H>
      <ul className="mt-2 list-disc pl-6 text-slate-700">
        <li>Bahasa Arab: kosakata benda di sekitar (كِتَابٌ، قَلَمٌ، بَابٌ) dan antonim dasar.</li>
        <li>Bahasa Inggris: kosakata benda, profesi, warna, hari, dan angka.</li>
        <li>Matematika: perkalian, pembagian, penjumlahan, dan pengurangan bilangan bulat.</li>
        <li>Kecepatan membaca soal, ketelitian, dan koordinasi mata–tangan.</li>
      </ul>

      <H>CARA BERMAIN</H>
      <ol className="mt-2 list-decimal pl-6 text-slate-700">
        <li>Pilih mode Solo (1 pemain), Duel (2 pemain), atau Squad (4 pemain).</li>
        <li>Pilih mata pelajaran dan jumlah soal, lalu atur suara bila perlu.</li>
        <li>Tunggu hitung mundur 3-2-1; waktu pertandingan berjalan dari 03:00.</li>
        <li>Baca soal di panel warna milikmu, lalu ketuk buah yang membawa jawaban benar.</li>
        <li>Buah benar menambah {10} poin dan mengganti soal; buah salah mengurangi {5} poin.</li>
        <li>Permainan berakhir saat waktu habis, atau tekan KELUAR (atau ESC) — skor tidak disimpan.</li>
      </ol>

      <H>MANFAAT PEMBELAJARAN</H>
      <p className="mt-2 text-slate-700">
        Melatih pengenalan kosakata secara refleks, memperkuat hitung cepat, dan membiasakan membaca teliti
        di bawah tekanan waktu. Riwayat skor tersimpan di perangkat (maksimum 50 catatan) dan dapat diekspor
        sebagai CSV, sehingga guru bisa memantau hasil latihan.
      </p>

      <H>FITUR</H>
      <ul className="mt-2 list-disc pl-6 text-slate-700">
        <li>Bank soal yang bisa ditambah, dihapus, diekspor, dan diimpor (tersimpan di perangkat).</li>
        <li>Tata letak panel bawah atau samping, dapat dipilih saat bermain di layar lebar.</li>
        <li>Tombol jawaban dapat dioperasikan dengan keyboard, dan ESC untuk keluar.</li>
      </ul>

      <H>MAIN SEKARANG</H>
      <p className="mt-2 text-slate-700">
        Tidak perlu instalasi maupun akun. Tekan tombol di bawah untuk membuka arena.
      </p>
      <Link
        href="/game/banua-fruit-blast/play"
        className="mt-4 inline-block rounded-2xl bg-emerald-950 px-8 py-4 text-lg font-black text-white shadow-lg transition active:scale-95"
      >
        MAIN SEKARANG
      </Link>

      <p className="mt-10 text-xs text-slate-500">
        Seluruh ilustrasi karakter, animasi buah, dan efek partikel dibuat khusus untuk permainan ini, bukan
        salinan dari situs mana pun.
      </p>
    </main>
  );
}
