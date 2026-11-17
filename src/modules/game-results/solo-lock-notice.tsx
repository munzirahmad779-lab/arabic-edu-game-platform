import Link from "next/link";
import { SYARAT_JUMLAH_DARS_TUNTAS } from "./solo-lock";

/**
 * Halaman pemberitahuan yang tampil menggantikan permainan pada
 * rute /student/play/<slug> bila siswa belum memenuhi syarat buka
 * kunci Game Solo (latihan tuntas untuk 7 dars yang berbeda).
 */
export default function SoloLockNotice({
  jumlahDarsTuntas,
}: {
  jumlahDarsTuntas: number;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-4">
      <section className="w-full max-w-md rounded-[2rem] border border-amber-200 bg-white p-8 text-center shadow-xl">
        <div className="text-6xl">🔒</div>
        <h1 className="mt-4 text-2xl font-black text-neutral-900">
          Game Solo Masih Terkunci
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Game Solo terbuka sesudah kamu menyelesaikan Latihan Siswa
          untuk {SYARAT_JUMLAH_DARS_TUNTAS} dars yang berbeda sampai
          tuntas. Sekarang kamu baru menyelesaikan latihan untuk{" "}
          {jumlahDarsTuntas} dari {SYARAT_JUMLAH_DARS_TUNTAS} dars.
          Selesaikan dulu latihanmu sampai tuntas, lalu kembali ke
          sini untuk bermain.
        </p>
        <Link
          href="/student/practice"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-6 py-3 text-sm font-black text-white shadow-md transition hover:bg-teal-700"
        >
          <span>Buka Latihan Mandiri</span>
        </Link>
      </section>
    </main>
  );
}
