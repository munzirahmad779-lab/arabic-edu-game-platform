/**
 * Penjaga idempotensi pencatatan jawaban di layar proyektor.
 *
 * Satu press fisik dari stik tiba di proyektor lewat tiga kanal sekaligus
 * (broadcast Supabase Realtime, BroadcastChannel, dan event store yang
 * diputar ulang poller HTTP). Pencatatan di proyektor sempat hanya
 * dijaga oleh guard closure `answers[teamId]`, yang bisa basi di antara
 * kedatangan kanal-kanal itu, sehingga penskoran (skor, correctCount,
 * streak, rotasi perwakilan) tereksekusi berulang untuk press yang sama
 * (anomali skor uji live 30 Okt 2026, kendala B.5).
 *
 * Penjaga ini adalah Set berkunci `${questionIndex}:${teamId}` yang
 * diperiksa dan ditandai secara sinkron di pintu masuk pencatatan,
 * sebelum pembaruan state apa pun. Pemanggil menyimpan Set di dalam ref
 * untuk satu permainan penuh: kunci berdimensi indeks soal, jadi tanda
 * soal lama tidak menghalangi jawaban soal baru, dan set ini sengaja
 * TIDAK dibersihkan saat indeks soal berubah, karena tanda soal lama
 * itulah yang menahan eksekusi ulang oleh closure basi dari soal lama
 * (anomali soal 19 putaran 3 uji live 30 Okt 2026: jawaban soal 18
 * tercatat dua kali, salinan keduanya diproses sesudah indeks naik).
 * Set hanya dibersihkan saat permainan selesai dan saat dimulai ulang,
 * jadi jawaban pertama yang sah pada soal yang sedang berjalan tidak
 * pernah tertahan: satu tim memang hanya menjawab sekali per soal.
 */

export function recordedAnswerKey(questionIndex: number, teamId: string): string {
  return `${questionIndex}:${teamId}`;
}

/**
 * Penolakan peristiwa basi di pintu masuk pencatatan.
 *
 * Payload press stik membawa indeks soal yang sedang ditampilkan stik
 * saat press lahir. Bila indeks itu terisi angka dan tidak sama dengan
 * indeks soal yang sedang berjalan di proyektor, peristiwa itu lahir
 * pada soal lain (biasanya soal sebelumnya, baru terantar sesudah
 * indeks naik) dan harus dibuang sebelum penjaga maupun penilaian:
 * menilainya akan memakai kunci jawaban soal lahirnya tetapi menulis
 * hasilnya ke state soal berjalan (anomali soal 19 putaran 3).
 *
 * Peristiwa tanpa indeks (tombol jawab manual guru di kartu proyektor,
 * putaran ulang poller yang event store-nya memang tidak menyimpan
 * indeks, dan payload klien lama) tidak ditolak di sini: jalur manual
 * memang peristiwa soal berjalan, dan jalur poller ditutup oleh cap
 * generasi pada poller itu sendiri.
 */
export function isAnswerEventStale(
  eventQuestionIndex: number | null | undefined,
  currentQuestionIndex: number,
): boolean {
  return (
    typeof eventQuestionIndex === "number" &&
    Number.isFinite(eventQuestionIndex) &&
    eventQuestionIndex !== currentQuestionIndex
  );
}

/**
 * Menandai satu pasangan soal+tim sebagai sudah dicatat.
 * Mengembalikan true bila ini kedatangan pertama (pencatatan boleh
 * lanjut) dan false bila duplikat (pencatatan harus berhenti tanpa efek).
 */
export function tryMarkRecordedAnswer(
  marked: Set<string>,
  questionIndex: number,
  teamId: string,
): boolean {
  const key = recordedAnswerKey(questionIndex, teamId);
  if (marked.has(key)) return false;
  marked.add(key);
  return true;
}
