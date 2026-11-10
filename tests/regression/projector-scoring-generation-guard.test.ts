/**
 * Regression: vonis jawaban dinilai memakai kunci soal lama
 * (anomali live 10 Nov 2026 sesudah perbaikan rekonsiliasi).
 *
 * Bukti live: pada soal 2 (kunci A), dua tim yang memilih A tercatat
 * di proyektor dan kartu opsi A berlabel "✓ BENAR", tetapi vonis tim
 * tertulis "✗ SALAH (A)" dengan 0 poin. Penjawab cepat paling sering
 * kena.
 *
 * Akar masalah (dari kode): handleRecordAnswer membekukan vonis
 * isCorrect saat pencatatan memakai correctOptionKey dari closure
 * render. Blok rekonsiliasi di pollControllerEvents berjalan TANPA
 * penjaga generasi (gelung event sudah terpenjaga), jadi respons poll
 * yang diterbitkan pada soal sebelumnya dapat menilai jawaban soal
 * baru memakai kunci lamanya; penanda duplikat lalu membuat vonis
 * salah itu permanen. Gejala pendamping: stik di controller/page.tsx
 * menyimpan kunci lokal hanya berdimensi indeks soal, sehingga
 * permainan baru yang mulai pada indeks yang sama mewarisi kunci
 * lama dan menolak klik baru.
 *
 * Perbaikan yang dijaga uji ini:
 * 1. Penanda generasi responseCrossedQuestionChange diangkat ke
 *    cakupan fungsi pollControllerEvents dan seluruh blok
 *    rekonsiliasi dilewati bila generasi berubah selama fetch.
 * 2. handleRecordAnswer menilai terhadap correctOptionKeyRef yang
 *    diperbarui setiap render, bukan nilai closure.
 * 3. Stik memperlakukan transisi masuk fase "question" dari fase
 *    bukan-"question" pada indeks yang sama sebagai syarat reset
 *    kunci lokal, kecuali payload menyatakan tim memang sudah
 *    menjawab.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const projectorSource = readFileSync(
  path.join(
    process.cwd(),
    "src/app/dashboard/games/[gameId]/projector/projector-screen.tsx",
  ),
  "utf8",
);

const controllerSource = readFileSync(
  path.join(process.cwd(), "src/app/controller/page.tsx"),
  "utf8",
);

// Potongan fungsi pollControllerEvents saja, supaya asersi generasi
// tidak tertukar dengan pemakaian nama yang sama di tempat lain.
const pollStart = projectorSource.indexOf(
  "const pollControllerEvents = useCallback(",
);
const pollEnd = projectorSource.indexOf(
  "}, [roomCode, phase, handleRecordAnswer]);",
  pollStart,
);
const pollSource = projectorSource.slice(pollStart, pollEnd);

describe("Penjaga generasi poller mencakup rekonsiliasi", () => {
  test("Fungsi poll ditemukan dan utuh", () => {
    assert.ok(pollStart >= 0);
    assert.ok(pollEnd > pollStart);
  });

  test("Penanda generasi didefinisikan tepat satu kali, di cakupan fungsi poll", () => {
    const definisi = pollSource.match(/const responseCrossedQuestionChange/g);
    assert.equal(definisi?.length, 1);
    // Tidak ada definisi kedua yang tersisa di dalam blok events:
    const definisiDiBerkas = projectorSource.match(
      /const responseCrossedQuestionChange/g,
    );
    assert.equal(definisiDiBerkas?.length, 1);
  });

  test("Penanda didefinisikan sebelum gelung event dan sebelum blok rekonsiliasi", () => {
    const defPos = pollSource.indexOf("const responseCrossedQuestionChange");
    const loopPos = pollSource.indexOf("for (const ev of data.events)");
    const rekonsiliasiPos = pollSource.indexOf("selectServerConfirmedAnswers(");
    assert.ok(defPos >= 0);
    assert.ok(loopPos > defPos);
    assert.ok(rekonsiliasiPos > defPos);
  });

  test("Gelung event tetap memakai penanda yang sama", () => {
    assert.ok(
      pollSource.includes("if (responseCrossedQuestionChange) continue;"),
    );
  });

  test("Blok rekonsiliasi berada di bawah syarat generasi yang sama", () => {
    const guardPos = pollSource.indexOf("if (!responseCrossedQuestionChange)");
    const selectPos = pollSource.indexOf("selectServerConfirmedAnswers(");
    assert.ok(guardPos >= 0);
    // Syarat generasi membuka blok sebelum pemilihan jawaban server:
    assert.ok(selectPos > guardPos);
    // Umpan ke handleRecordAnswer juga di dalam blok terjaga itu:
    const feedPos = pollSource.indexOf("entry.teamId", guardPos);
    assert.ok(feedPos > guardPos);
  });
});

describe("Penilaian handleRecordAnswer membaca ref kunci berjalan", () => {
  const fnStart = projectorSource.indexOf(
    "const handleRecordAnswer = useCallback(",
  );
  const fnEnd = projectorSource.indexOf(
    "// Kunci penjaga anti duplikat SENGAJA tidak dibersihkan",
    fnStart,
  );
  const fnSource = projectorSource.slice(fnStart, fnEnd);

  test("correctOptionKeyRef didefinisikan dan diperbarui setiap render", () => {
    assert.ok(
      projectorSource.includes(
        "const correctOptionKeyRef = useRef(correctOptionKey);",
      ),
    );
    assert.ok(
      projectorSource.includes(
        "correctOptionKeyRef.current = correctOptionKey;",
      ),
    );
  });

  test("Perbandingan kunci di handleRecordAnswer membaca ref, bukan closure", () => {
    assert.ok(fnStart >= 0);
    assert.ok(fnEnd > fnStart);
    assert.ok(
      fnSource.includes(
        "const isCorrect = keyUpper === correctOptionKeyRef.current;",
      ),
    );
    assert.ok(!fnSource.includes("keyUpper === correctOptionKey;"));
  });

  test("Penjaga lama tetap utuh dan berurutan: fase, basi, duplikat", () => {
    const phasePos = fnSource.indexOf(
      '!(serverConfirmed && phase === "reveal")',
    );
    const stalePos = fnSource.indexOf("isAnswerEventStale(", phasePos);
    const markPos = fnSource.indexOf("tryMarkRecordedAnswer(", stalePos);
    const nilaiPos = fnSource.indexOf("correctOptionKeyRef.current", markPos);
    assert.ok(phasePos >= 0);
    assert.ok(stalePos > phasePos);
    assert.ok(markPos > stalePos);
    // Penilaian dari ref terjadi sesudah ketiga penjaga itu:
    assert.ok(nilaiPos > markPos);
  });
});

describe("Reset kunci stik saat masuk fase question", () => {
  test("Fase sebelumnya dilacak lewat prevPhaseRef meniru prevQIndexRef", () => {
    assert.ok(
      controllerSource.includes(
        "const prevPhaseRef = useRef<string | null>(null);",
      ),
    );
    assert.ok(controllerSource.includes("prevPhaseRef.current = nextPhase;"));
  });

  test("Syarat masuk-question terdefinisi dari transisi fase", () => {
    assert.ok(controllerSource.includes("const isEnteringQuestion ="));
    assert.ok(controllerSource.includes('nextPhase === "question"'));
    assert.ok(controllerSource.includes('prevPhase !== "question"'));
  });

  test("Kunci lokal dibersihkan sebelum hitungan lengket, hanya bila tim belum menjawab", () => {
    const clearPos = controllerSource.indexOf(
      "if (isEnteringQuestion && !teamHasAnswered)",
    );
    const stickyPos = controllerSource.indexOf("const stickyAnswered");
    assert.ok(clearPos >= 0);
    assert.ok(stickyPos > clearPos);
    // Pembersihan menyentuh kedua ref kunci lokal:
    const clearBlock = controllerSource.slice(clearPos, stickyPos);
    assert.ok(clearBlock.includes("answeredQIndexRef.current = -1;"));
    assert.ok(clearBlock.includes("answeredKeyRef.current = null;"));
  });

  test("Cabang buka kunci tampilan juga mengenal syarat masuk-question", () => {
    assert.ok(
      controllerSource.includes("(isEnteringQuestion && !teamHasAnswered) ||"),
    );
    // Syarat lama tidak berubah: soal baru dan fase reset tetap ada.
    assert.ok(
      controllerSource.includes("(isNewQuestion && !teamHasAnswered) ||"),
    );
    assert.ok(controllerSource.includes("isResetPhase"));
  });
});
