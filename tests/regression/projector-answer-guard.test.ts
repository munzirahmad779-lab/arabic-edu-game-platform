/**
 * Regression: anomali skor proyektor karena penskoran tereksekusi
 * berulang untuk satu press (temuan uji live sesudah deploy 0078,
 * 30 Okt 2026, kendala B.5).
 *
 * Akar masalah: satu press stik tiba di proyektor lewat tiga kanal
 * (broadcast Supabase Realtime, BroadcastChannel, putaran ulang poller
 * HTTP), sedangkan handleRecordAnswer hanya dijaga guard closure
 * answers[teamId] yang bisa basi di antara kedatangan kanal-kanal itu.
 * Satu jawaban benar bisa diskor berulang (teramati 7 kali eksekusi
 * pada satu soal), menggembungkan skor, correctCount, streak, dan
 * rotasi perwakilan.
 *
 * Perbaikan: penjaga ref sinkron berkunci `${questionIndex}:${teamId}`
 * (helper murni projector-answer-guard) yang dicentang dan ditandai di
 * pintu masuk handleRecordAnswer sebelum state apa pun diubah, dan
 * dibersihkan saat permainan selesai dan saat dimulai ulang.
 *
 * Lanjutan: anomali soal 19 putaran 3 (30 Okt 2026). Jawaban soal 18
 * milik tim penekan terakhir tercatat dua kali: putaran ulangnya baru
 * diproses sesudah indeks naik ke soal 19 oleh closure basi, dan lolos
 * karena set penjaga dibersihkan seluruhnya tepat saat indeks berganti
 * (effect lama di projector-screen), tidak ada jalur masuk yang
 * membandingkan indeks soal peristiwa dengan indeks berjalan, dan
 * poller memutar ulang event tanpa cap generasi. Tiga lapis perbaikan:
 * (1) set penjaga TIDAK lagi dibersihkan saat indeks berubah, karena
 * kunci sudah berdimensi indeks; (2) handleRecordAnswer menolak
 * peristiwa yang indeks soalnya tidak sama dengan indeks berjalan
 * (dibaca dari ref), dan kedua listener broadcast meneruskan
 * questionIndex yang dikirim stik; (3) poller membuang respons yang
 * diterbitkan sebelum pergantian soal terakhir (cap generasi) dan
 * melewati event yang tidak lebih baru dari watermark pemrosesan.
 *
 * Supersesi W5-K2 (commit dadf6c7, mega-audit wilayah 5, Kritis 2):
 * lapis (2) berubah bentuk dan lapis (3) berpindah tempat. Payload
 * broadcast tak terautentikasi tidak boleh menjadi skor sama sekali,
 * jadi kedua listener tidak lagi membaca payload untuk menskor dan
 * tidak lagi meneruskan questionIndex ke pencatatan; keduanya hanya
 * memicu pollControllerEvents. Penskoran kini hanya dari event store
 * server (RPC press atomik berpenjaga fase yang menolak
 * STALE_QUESTION dan ALREADY_ANSWERED), dan penolakan indeks basi di
 * handleRecordAnswer tetap berlaku bagi jalur yang memang membawa
 * indeks (rekonsiliasi jawaban terkonfirmasi server). Seluruh logika
 * poller lapis (3) pindah utuh ke pollControllerEvents supaya satu
 * fungsi yang sama bisa dipicu seketika oleh broadcast maupun oleh
 * interval berkala. Dua uji struktur di bawah yang masih menegaskan
 * bentuk lama gagal sejak gabungan itu dan diperbarui 10 Nov 2026
 * untuk menegaskan arsitektur yang benar ini, bukan bentuk lamanya.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isAnswerEventStale,
  recordedAnswerKey,
  tryMarkRecordedAnswer,
} from "../../src/lib/game-engine/projector-answer-guard";

describe("Penjaga anti duplikat pencatatan jawaban proyektor", () => {
  test("Kunci berbentuk indeksSoal:teamId", () => {
    assert.equal(recordedAnswerKey(3, "team-2"), "3:team-2");
    assert.equal(recordedAnswerKey(0, "team-4"), "0:team-4");
  });

  test("Kedatangan pertama lolos, duplikat soal+tim yang sama ditolak", () => {
    const marked = new Set<string>();
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), true);
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), false);
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), false);
    assert.equal(marked.size, 1);
  });

  test("Tim lain pada soal yang sama dan tim yang sama pada soal lain tetap lolos", () => {
    const marked = new Set<string>();
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-3"), true);
    assert.equal(tryMarkRecordedAnswer(marked, 5, "team-4"), true);
    assert.equal(tryMarkRecordedAnswer(marked, 6, "team-3"), true);
    assert.equal(marked.size, 3);
  });

  test("Sesudah set dibersihkan (mulai ulang / permainan selesai), tim yang sama lolos lagi", () => {
    const marked = new Set<string>();
    assert.equal(tryMarkRecordedAnswer(marked, 0, "team-1"), true);
    marked.clear();
    assert.equal(tryMarkRecordedAnswer(marked, 0, "team-1"), true);
  });

  test("SKENARIO SOAL 19: tanda soal lama bertahan melewati pergantian soal dan menahan kedatangan basi", () => {
    const marked = new Set<string>();
    // Pencatatan sah penekan terakhir soal 18 (indeks 17, team-4):
    // tertandai di bawah indeks soal lahirnya.
    assert.equal(tryMarkRecordedAnswer(marked, 17, "team-4"), true);
    // Indeks naik ke 18 TANPA membersihkan set. Inilah perilaku sesudah
    // perbaikan; effect lama membersihkan seluruh set tepat di titik
    // ini dan membuka pintu bagi pencatatan hantu.
    // Kedatangan basi: closure soal 18 memutar ulang press yang sama dan
    // menandai di bawah indeks lamanya. Harus ditolak, tanpa efek apa
    // pun ke soal berjalan.
    assert.equal(tryMarkRecordedAnswer(marked, 17, "team-4"), false);
    assert.equal(tryMarkRecordedAnswer(marked, 17, "team-4"), false);
    // Jawaban sah soal baru (indeks 18) dari tim yang sama tetap lolos:
    // kunci berdimensi indeks, tanda lama tidak menghalangi soal baru.
    assert.equal(tryMarkRecordedAnswer(marked, 18, "team-4"), true);
    assert.equal(marked.size, 2);
  });
});

const projectorSource = readFileSync(
  path.join(
    process.cwd(),
    "src/app/dashboard/games/[gameId]/projector/projector-screen.tsx",
  ),
  "utf8",
);

describe("Penjaga terpasang di handleRecordAnswer layar proyektor", () => {
  test("Penjaga dipanggil sebelum guard answers[teamId] di dalam handleRecordAnswer", () => {
    const fnStart = projectorSource.indexOf("const handleRecordAnswer = useCallback(");
    assert.ok(fnStart >= 0);
    const guardPos = projectorSource.indexOf(
      "tryMarkRecordedAnswer(",
      fnStart,
    );
    const answersGuardPos = projectorSource.indexOf(
      "if (answers[teamId]) return;",
      fnStart,
    );
    assert.ok(guardPos > fnStart);
    assert.ok(answersGuardPos > guardPos);
  });

  test("Set penjaga dipertahankan saat indeks soal berubah; dibersihkan hanya saat mulai ulang dan selesai", () => {
    // Harapan lama di tes ini (set dibersihkan pada perubahan indeks)
    // adalah lubangnya sendiri: tanda 17:team-4 terhapus tepat sebelum
    // kelanjutan basi soal 18 berjalan, sehingga press yang sama bisa
    // dinilai ulang dan ditulis ke state soal 19. Kini effect pembersih
    // itu tidak boleh ada lagi.
    assert.doesNotMatch(
      projectorSource,
      /recordedAnswerKeysRef\.current\.clear\(\);\s*\n\s*\}, \[currentQuestionIndex\]\);/,
    );
    // Pembersihan yang tersisa tepat dua tempat: cabang selesai
    // permainan dan mulai ulang.
    const clearCount =
      projectorSource.match(/recordedAnswerKeysRef\.current\.clear\(\);/g)
        ?.length ?? 0;
    assert.equal(clearCount, 2);
    const restartStart = projectorSource.indexOf("const handleRestartGame = () => {");
    assert.ok(restartStart >= 0);
    const restartClearPos = projectorSource.indexOf(
      "recordedAnswerKeysRef.current.clear();",
      restartStart,
    );
    const restartBodyEnd = projectorSource.indexOf("setTeams(", restartStart);
    assert.ok(restartClearPos > restartStart && restartClearPos < restartBodyEnd);
  });
});

describe("Penolakan indeks peristiwa basi di pintu masuk pencatatan", () => {
  test("Peristiwa berindeks 17 yang tiba saat indeks berjalan 18 ditolak; berindeks 18 diterima", () => {
    assert.equal(isAnswerEventStale(17, 18), true);
    assert.equal(isAnswerEventStale(0, 18), true);
    // Indeks dari masa depan juga bukan peristiwa soal berjalan.
    assert.equal(isAnswerEventStale(19, 18), true);
    assert.equal(isAnswerEventStale(18, 18), false);
  });

  test("Peristiwa tanpa indeks (jalur manual guru, poller, klien lama) diterima", () => {
    assert.equal(isAnswerEventStale(undefined, 18), false);
    assert.equal(isAnswerEventStale(null, 18), false);
    assert.equal(isAnswerEventStale(Number.NaN, 18), false);
  });

  test("handleRecordAnswer memeriksa indeks peristiwa terhadap ref berjalan sebelum penjaga", () => {
    const fnStart = projectorSource.indexOf(
      "const handleRecordAnswer = useCallback(",
    );
    assert.ok(fnStart >= 0);
    // Tanda tangan bertambah parameter serverConfirmed (rekonsiliasi
    // tahap D audit live 10 Nov 2026, lihat
    // projector-answer-reconciliation.test.ts); indeks peristiwa
    // tetap parameter ketiga dan pemeriksaan basi di bawah tidak
    // berubah.
    assert.match(
      projectorSource.slice(fnStart, fnStart + 220),
      /\(\s*teamId: string,\s*optionKey: string,\s*eventQuestionIndex\?: number,\s*serverConfirmed = false,\s*\)/,
    );
    const stalePos = projectorSource.indexOf("isAnswerEventStale(", fnStart);
    const guardPos = projectorSource.indexOf("tryMarkRecordedAnswer(", fnStart);
    assert.ok(stalePos > fnStart);
    assert.ok(guardPos > stalePos);
    // Perbandingannya terhadap ref cermin indeks berjalan, bukan closure.
    assert.match(
      projectorSource,
      /const currentQuestionIndexRef = useRef\(currentQuestionIndex\);/,
    );
    assert.match(
      projectorSource,
      /currentQuestionIndexRef\.current = currentQuestionIndex;/,
    );
    assert.match(
      projectorSource,
      /isAnswerEventStale\(eventQuestionIndex, currentQuestionIndexRef\.current\)/,
    );
  });

  test("Kedua listener broadcast tidak menskor langsung; controller_press hanya memicu pollControllerEvents (W5-K2)", () => {
    // Uji ini sebelumnya menegaskan bentuk lama: kedua listener
    // membaca { teamId, optionKey, questionIndex } dari payload lalu
    // memanggil handleRecordAnswer(teamId, optionKey, questionIndex).
    // Bentuk itu adalah celah Kritis W5-K2 (payload broadcast tak
    // terautentikasi menjadi skor, bisa dipalsukan dari konsol
    // peramban mana pun yang tahu kode room) dan memang dihapus
    // commit dadf6c7. Yang ditegaskan kini adalah arsitektur
    // penggantinya, dengan pagar negatif yang mengunci celah itu
    // agar tidak kembali.
    assert.doesNotMatch(
      projectorSource,
      /handleRecordAnswer\(teamId, optionKey, questionIndex\)/,
    );
    assert.doesNotMatch(
      projectorSource,
      /const \{ teamId, optionKey, questionIndex \} = (payload|ev\.data\.payload);/,
    );
    // Listener Supabase: controller_press hanya memicu poll segera.
    const sbListenerPos = projectorSource.indexOf(
      '.on("broadcast", { event: "controller_press" }',
    );
    assert.ok(sbListenerPos >= 0);
    const sbTriggerPos = projectorSource.indexOf(
      "void pollControllerEvents();",
      sbListenerPos,
    );
    assert.ok(sbTriggerPos > sbListenerPos && sbTriggerPos < sbListenerPos + 200);
    // Listener BroadcastChannel: controller_press juga hanya pemicu.
    const bcListenerPos = projectorSource.indexOf("bc.onmessage = (ev) => {");
    assert.ok(bcListenerPos >= 0);
    const bcTriggerPos = projectorSource.indexOf(
      "void pollControllerEvents();",
      bcListenerPos,
    );
    assert.ok(bcTriggerPos > bcListenerPos && bcTriggerPos < bcListenerPos + 400);
    // Tepat tiga pemicu pollControllerEvents di seluruh berkas: dua
    // listener di atas dan interval berkala. Tidak ada jalur skor
    // keempat yang menyelinap di luar event store server.
    const triggerCount =
      projectorSource.match(/void pollControllerEvents\(\);/g)?.length ?? 0;
    assert.equal(triggerCount, 3);
  });
});

describe("Poller proyektor menolak respons lintas pergantian soal", () => {
  test("Generasi poller naik setiap kali indeks soal berubah", () => {
    assert.match(projectorSource, /const pollGenerationRef = useRef\(0\);/);
    assert.match(
      projectorSource,
      /pollGenerationRef\.current \+= 1;\s*\n\s*\}, \[currentQuestionIndex\]\);/,
    );
  });

  test("Fetch menangkap generasi saat diterbitkan dan respons tertinggal dibuang sebelum pemrosesan event", () => {
    // Jangkar uji digeser dari komentar "// Wireless Phone
    // Controller Poller" ke definisi pollControllerEvents. Sejak
    // W5-K2 seluruh logika fetch + saring generasi/watermark tinggal
    // di callback itu (supaya broadcast bisa memicunya seketika),
    // sedangkan komentar lama kini menandai effect interval yang
    // hanya memanggilnya berkala. Isi dan urutan penjaganya tidak
    // berubah; yang berubah hanya tempat tinggalnya.
    const fnStart = projectorSource.indexOf(
      "const pollControllerEvents = useCallback(async () => {",
    );
    assert.ok(fnStart >= 0);
    const capturePos = projectorSource.indexOf(
      "const issuedGeneration = pollGenerationRef.current;",
      fnStart,
    );
    const fetchPos = projectorSource.indexOf("await fetch(", capturePos);
    const comparePos = projectorSource.indexOf(
      "issuedGeneration !== pollGenerationRef.current",
      fetchPos,
    );
    const continuePos = projectorSource.indexOf(
      "if (responseCrossedQuestionChange) continue;",
      comparePos,
    );
    const recordPos = projectorSource.indexOf(
      "handleRecordAnswer(ev.teamId, ev.optionKey)",
      continuePos,
    );
    assert.ok(capturePos > fnStart);
    assert.ok(fetchPos > capturePos);
    assert.ok(comparePos > fetchPos);
    assert.ok(continuePos > comparePos);
    assert.ok(recordPos > continuePos);
    assert.match(
      projectorSource,
      /if \(responseCrossedQuestionChange\) continue;/,
    );
    // Effect interval di bawah penanda lama menjalankan fungsi yang
    // sama, bukan salinan logika kedua.
    const pollerStart = projectorSource.indexOf(
      "// Wireless Phone Controller Poller",
    );
    assert.ok(pollerStart >= 0);
    const intervalTriggerPos = projectorSource.indexOf(
      "void pollControllerEvents();",
      pollerStart,
    );
    assert.ok(intervalTriggerPos > pollerStart);
  });

  test("Event yang tidak lebih baru dari watermark saat pemrosesan dilewati (lapis kedua)", () => {
    assert.match(
      projectorSource,
      /const processedWatermark = lastEventTimestampRef\.current;/,
    );
    assert.match(
      projectorSource,
      /if \(ev\.timestamp <= processedWatermark\) continue;/,
    );
  });
});
