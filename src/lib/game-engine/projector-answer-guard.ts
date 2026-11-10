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
 * Rekonsiliasi jawaban terkonfirmasi server (audit live 10 Nov 2026,
 * tahap D: jawaban stik yang terkunci hilang dari proyektor).
 *
 * Peta answeredTeams di state room server adalah catatan otoritatif:
 * RPC press_projector_button menulisnya secara atomik bersama event
 * (satu transaksi per press), dan sync_projector_room_state
 * menggabungkannya dengan union pada indeks soal yang sama, jadi
 * jawaban yang sudah diterima server tidak pernah terhapus oleh
 * sinkronisasi mana pun. Sebaliknya state lokal layar dibangun hanya
 * dari aliran event poller, yang menyaring secara ketat (watermark,
 * cap generasi, fase saat pemrosesan): event yang sah bisa terlewat
 * dan, tanpa rekonsiliasi, jawaban itu hilang dari layar dan dari
 * laporan padahal server menyimpannya.
 *
 * Fungsi murni ini memilih entri yang boleh diumpankan ke pencatatan
 * layar: hanya bila indeks soal server sama dengan indeks soal yang
 * sedang berjalan di layar (peta soal lain tidak berlaku), entri
 * berbentuk sah saja, dan terurut menaik menurut cap waktu server
 * supaya urutan kedatangan (bonus kecepatan) mendekati urutan
 * sebenarnya. Hasilnya hanya-menambah: pemanggil mengumpankan tiap
 * entri ke handleRecordAnswer, yang penjaga duplikatnya
 * (tryMarkRecordedAnswer + answers[teamId]) memastikan jawaban yang
 * sudah tercatat lewat aliran event tidak diskor dua kali, dan tidak
 * ada jalur yang menghapus jawaban yang sudah tercatat.
 */
export function selectServerConfirmedAnswers(
  serverAnsweredTeams:
    | Record<string, { optionKey?: unknown; timestamp?: unknown } | null | undefined>
    | null
    | undefined,
  serverQuestionIndex: number | null | undefined,
  currentQuestionIndex: number,
): { teamId: string; optionKey: string; timestamp: number }[] {
  if (
    typeof serverQuestionIndex !== "number" ||
    !Number.isFinite(serverQuestionIndex) ||
    serverQuestionIndex !== currentQuestionIndex
  ) {
    return [];
  }
  if (!serverAnsweredTeams || typeof serverAnsweredTeams !== "object") {
    return [];
  }
  const selected: { teamId: string; optionKey: string; timestamp: number }[] =
    [];
  for (const [teamId, entry] of Object.entries(serverAnsweredTeams)) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.optionKey !== "string" || entry.optionKey === "") {
      continue;
    }
    selected.push({
      teamId,
      optionKey: entry.optionKey,
      timestamp:
        typeof entry.timestamp === "number" &&
        Number.isFinite(entry.timestamp)
          ? entry.timestamp
          : 0,
    });
  }
  selected.sort((a, b) => a.timestamp - b.timestamp);
  return selected;
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
