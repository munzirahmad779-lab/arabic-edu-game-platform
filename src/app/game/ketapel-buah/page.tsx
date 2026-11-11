import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ketapel Buah — Tembak Buah Jawaban Benar",
  description:
    "Game edukasi ketapel buah: jawab soal Bahasa Arab, Bahasa Inggris, Matematika, Biologi, dan Fisika dengan menembak buah jawaban yang benar. Mode Solo, Duel, Trio, dan Quad untuk 1–4 pemain di satu layar.",
};

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-10 border-l-4 border-amber-400 pl-3 text-lg font-black text-indigo-950">{children}</h2>
);

export default function KetapelBuahLanding() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
      >
        ← Kembali ke Dashboard
      </Link>

      <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-700">Game Edukasi</p>
      <h1 className="mt-2 text-3xl font-black leading-tight text-indigo-950 sm:text-4xl">
        Ketapel Buah — Tembak Buah Jawaban Benar
      </h1>
      <p className="mt-3 text-slate-700">
        Pohon di tiap lajur dipenuhi buah foto Sulawesi. Setiap soal mengisi pohon dengan tujuh buah:
        empat buah jawaban soal itu dan tiga buah penyamar yang labelnya meminjam jawaban benar soal
        lain. Baca soal di kartumu, tarik ketapel, lalu tembak buah yang memuat jawaban benar.
      </p>

      <Link
        href="/game/ketapel-buah/play"
        className="mt-6 inline-block rounded-2xl bg-amber-400 px-8 py-4 text-xl font-black text-indigo-950 shadow-lg transition active:scale-95"
        data-start="1"
      >
        MULAI
      </Link>

      <H>TARGET AUDIENS</H>
      <p className="mt-2 text-slate-700">
        Siswa SD dan SMP yang sedang menguatkan kosakata Bahasa Arab, kosakata Bahasa Inggris,
        aritmetika dasar, serta dasar Biologi dan Fisika. Juga cocok untuk guru yang memakai layar
        interaktif (IFP/Smartboard) di kelas: mode Duel, Trio, dan Quad membagi arena menjadi dua
        sampai empat lajur sehingga tiap siswa punya pohon sendiri.
      </p>

      <H>KONTEKS EDUKASI</H>
      <p className="mt-2 text-slate-700">
        Dirancang untuk pengulangan cepat (drill) di awal atau akhir pelajaran. Satu pertandingan
        berlangsung tiga menit, soal diacak ulang setiap sesi, dan peserta bisa memilih mata
        pelajaran sesuai kebutuhan kelas. Buah penyamar melatih siswa membaca teliti, bukan sekadar
        mengenali label yang pernah terlihat.
      </p>

      <H>FOKUS BELAJAR</H>
      <ul className="mt-2 list-disc pl-6 text-slate-700">
        <li>Bahasa Arab: kosakata benda di sekitar (كِتَابٌ، قَلَمٌ، بَابٌ) dan antonim dasar.</li>
        <li>Bahasa Inggris: kosakata benda, profesi, warna, hari, dan angka.</li>
        <li>Matematika: perkalian, pembagian, penjumlahan, dan pengurangan bilangan bulat.</li>
        <li>Biologi dan Fisika dasar sesuai bank soal bawaan.</li>
        <li>Ketelitian membedakan jawaban benar dari penyamar, dan koordinasi mata–tangan.</li>
      </ul>

      <H>CARA BERMAIN</H>
      <ol className="mt-2 list-decimal pl-6 text-slate-700">
        <li>Pilih mode Solo (1 pemain), Duel (2 pemain), Trio (3 pemain), atau Quad (4 pemain).</li>
        <li>Pilih mata pelajaran dan atur suara bila perlu.</li>
        <li>Tunggu hitung mundur 3-2-1; waktu pertandingan berjalan dari 03:00.</li>
        <li>Baca soal di kartu lajurmu, lalu tarik ketapel dan lepaskan untuk menembak buah.</li>
        <li>Buah benar menambah {10} poin dan soal berganti; buah salah atau penyamar mengurangi {1} poin dan soal yang sama berlanjut sampai buah benarnya kena.</li>
        <li>Meleset tidak mengurangi poin: tembak lagi. Permainan berakhir saat waktu habis atau tombol keluar ditekan.</li>
      </ol>

      <H>MANFAAT PEMBELAJARAN</H>
      <p className="mt-2 text-slate-700">
        Melatih pengenalan kosakata secara refleks, memperkuat hitung cepat, dan membiasakan membaca
        teliti di bawah tekanan waktu. Riwayat skor tersimpan di perangkat (maksimum 50 catatan) dan
        dapat diekspor sebagai CSV, sehingga guru bisa memantau hasil latihan.
      </p>

      <H>FITUR</H>
      <ul className="mt-2 list-disc pl-6 text-slate-700">
        <li>Bank soal yang bisa ditambah, dihapus, diekspor, dan diimpor Markdown/CSV (tersimpan di perangkat).</li>
        <li>Mapel Guru: bank khusus milik guru, termasuk memakai soal dari Bank Soal LMS.</li>
        <li>Di HP (layar sempit) hanya mode Solo yang ditawarkan.</li>
      </ul>

      <H>MAIN SEKARANG</H>
      <p className="mt-2 text-slate-700">
        Tidak perlu instalasi maupun akun tambahan. Tekan tombol di bawah untuk membuka arena.
      </p>
      <Link
        href="/game/ketapel-buah/play"
        className="mt-4 inline-block rounded-2xl bg-indigo-950 px-8 py-4 text-lg font-black text-white shadow-lg transition active:scale-95"
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
