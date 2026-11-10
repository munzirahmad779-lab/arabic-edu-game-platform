/**
 * Regression: jawaban stik yang terkonfirmasi server hilang dari
 * proyektor (audit live 10 Nov 2026, tahap D).
 *
 * Bukti live: dari 8 jawaban yang terkonfirmasi TERKUNCI di kontroler,
 * hanya 5 tercatat di proyektor; 3 hilang tanpa pesan dan ditandai
 * "Waktu Habis". Pola dari pemilik: siswa yang selesai menjawab
 * dengan CEPAT justru riwayat jawabannya di proyektor ikut hilang.
 * Pada satu soal dengan timer dijeda, dua jawaban salah (terkunci
 * lebih lambat) tercatat sedangkan dua jawaban benar (terkunci lebih
 * dulu) hilang.
 *
 * Akar masalah (dari kode): catatan server tidak pernah kehilangan
 * jawaban (RPC press_projector_button menulis answeredTeams secara
 * atomik, sync_projector_room_state menggabungkannya dengan union
 * pada indeks yang sama), tetapi layar tidak pernah membaca kembali
 * state server: pollControllerEvents hanya menskor data.events dan
 * mengabaikan data.gameState. Aliran event menyaring secara ketat:
 * cap generasi membuang seluruh respons yang melintasi pergantian
 * soal sementara watermark tetap maju melewatinya (press tercepat
 * soal baru yang menumpang respons lama hilang permanen), dan event
 * hanya diskor bila fase saat PEMROSESAN masih "question" (jawaban
 * yang diterima server tepat waktu tetapi baru ter-poll sesudah
 * reveal dikonsumsi watermark tanpa diskor).
 *
 * Perbaikan: rekonsiliasi hanya-menambah pada setiap poll. Route GET
 * mengirim peta answeredTeams server hanya kepada pemanggil
 * terautentikasi (layar guru); poller memilih entri yang indeks
 * servernya sama dengan indeks berjalan (helper murni
 * selectServerConfirmedAnswers), terurut menurut cap waktu server,
 * lalu mengumpankannya ke handleRecordAnswer dengan tanda
 * serverConfirmed. Penjaga duplikat yang sudah ada memastikan entri
 * yang sudah tercatat lewat aliran event tidak diskor dua kali, dan
 * fase reveal soal yang sama diterima khusus untuk jalur ini karena
 * RPC press hanya menerima jawaban selama fase question di server.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  selectServerConfirmedAnswers,
  tryMarkRecordedAnswer,
} from "../../src/lib/game-engine/projector-answer-guard";

describe("Pemilihan jawaban terkonfirmasi server untuk rekonsiliasi", () => {
  test("Indeks server sama dengan indeks berjalan: semua entri sah terpilih, terurut menurut cap waktu server", () => {
    const selected = selectServerConfirmedAnswers(
      {
        "team-2": { optionKey: "B", timestamp: 3000 },
        "team-1": { optionKey: "D", timestamp: 1000 },
        "team-3": { optionKey: "A", timestamp: 2000 },
      },
      4,
      4,
    );
    assert.deepEqual(selected, [
      { teamId: "team-1", optionKey: "D", timestamp: 1000 },
      { teamId: "team-3", optionKey: "A", timestamp: 2000 },
      { teamId: "team-2", optionKey: "B", timestamp: 3000 },
    ]);
  });

  test("SKENARIO TAHAP D: dua jawaban benar yang terkunci lebih dulu tetap terpilih walau aliran event melewatkannya", () => {
    // Peta server sesudah keempat tim menekan pada satu soal: Merah
    // dan Hijau (benar) terkunci lebih dulu, Biru dan Kuning (salah)
    // belakangan. Aliran event hanya mengantar dua yang salah; peta
    // server mengantar keempatnya, yang benar lebih dulu.
    const selected = selectServerConfirmedAnswers(
      {
        "team-1": { optionKey: "A", timestamp: 1100 }, // Merah, benar, cepat
        "team-3": { optionKey: "A", timestamp: 1200 }, // Hijau, benar, cepat
        "team-2": { optionKey: "B", timestamp: 5000 }, // Biru, salah
        "team-4": { optionKey: "C", timestamp: 6000 }, // Kuning, salah
      },
      1,
      1,
    );
    assert.equal(selected.length, 4);
    assert.equal(selected[0].teamId, "team-1");
    assert.equal(selected[1].teamId, "team-3");
  });

  test("Indeks server berbeda dari indeks berjalan: tidak ada yang terpilih (peta soal lain tidak berlaku)", () => {
    assert.deepEqual(
      selectServerConfirmedAnswers(
        { "team-1": { optionKey: "A", timestamp: 1000 } },
        3,
        4,
      ),
      [],
    );
    assert.deepEqual(
      selectServerConfirmedAnswers(
        { "team-1": { optionKey: "A", timestamp: 1000 } },
        5,
        4,
      ),
      [],
    );
  });

  test("Peta kosong, hilang, atau indeks bukan angka: hasil kosong tanpa galat", () => {
    assert.deepEqual(selectServerConfirmedAnswers({}, 0, 0), []);
    assert.deepEqual(selectServerConfirmedAnswers(null, 0, 0), []);
    assert.deepEqual(selectServerConfirmedAnswers(undefined, 0, 0), []);
    assert.deepEqual(
      selectServerConfirmedAnswers(
        { "team-1": { optionKey: "A", timestamp: 1 } },
        undefined,
        0,
      ),
      [],
    );
    assert.deepEqual(
      selectServerConfirmedAnswers(
        { "team-1": { optionKey: "A", timestamp: 1 } },
        Number.NaN,
        0,
      ),
      [],
    );
  });

  test("Entri rusak dilewati; entri sah di sebelahnya tetap terpilih; cap waktu rusak dianggap 0", () => {
    const selected = selectServerConfirmedAnswers(
      {
        "team-1": null,
        "team-2": { optionKey: 42, timestamp: 1000 },
        "team-3": { optionKey: "", timestamp: 1000 },
        "team-4": { optionKey: "C", timestamp: "kemarin" },
        "team-5": { optionKey: "B", timestamp: 500 },
      },
      2,
      2,
    );
    assert.deepEqual(selected, [
      { teamId: "team-4", optionKey: "C", timestamp: 0 },
      { teamId: "team-5", optionKey: "B", timestamp: 500 },
    ]);
  });

  test("Hanya-menambah dan idempoten bersama penjaga duplikat: putaran rekonsiliasi kedua tidak menandai apa pun lagi", () => {
    const serverMap = {
      "team-1": { optionKey: "A", timestamp: 1000 },
      "team-2": { optionKey: "B", timestamp: 2000 },
    };
    const marked = new Set<string>();
    // Putaran pertama (event untuk team-2 sudah tiba lewat aliran
    // event lebih dulu, team-1 hanya ada di peta server):
    assert.equal(tryMarkRecordedAnswer(marked, 7, "team-2"), true);
    const firstPass = selectServerConfirmedAnswers(serverMap, 7, 7).filter(
      (entry) => tryMarkRecordedAnswer(marked, 7, entry.teamId),
    );
    assert.deepEqual(
      firstPass.map((entry) => entry.teamId),
      ["team-1"],
    );
    // Putaran kedua dengan peta yang sama: tidak ada tanda baru,
    // tidak ada yang terhapus dari set.
    const secondPass = selectServerConfirmedAnswers(serverMap, 7, 7).filter(
      (entry) => tryMarkRecordedAnswer(marked, 7, entry.teamId),
    );
    assert.deepEqual(secondPass, []);
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

const routeSource = readFileSync(
  path.join(process.cwd(), "src/app/api/projector/controller/route.ts"),
  "utf8",
);

describe("Rekonsiliasi terpasang di poller dan route", () => {
  test("Poller menjalankan rekonsiliasi dari gameState server pada setiap poll", () => {
    const pollStart = projectorSource.indexOf(
      "const pollControllerEvents = useCallback(",
    );
    assert.ok(pollStart >= 0);
    const selectPos = projectorSource.indexOf(
      "selectServerConfirmedAnswers(",
      pollStart,
    );
    assert.ok(selectPos > pollStart);
    const feedPos = projectorSource.indexOf("serverConfirmedAnswers", selectPos);
    assert.ok(feedPos > selectPos);
    // Umpan rekonsiliasi membawa indeks server dan tanda konfirmasi:
    const callPos = projectorSource.indexOf(
      "entry.teamId",
      selectPos,
    );
    assert.ok(callPos > selectPos);
    assert.ok(
      projectorSource.slice(selectPos, selectPos + 900).includes("true"),
    );
  });

  test("handleRecordAnswer menerima fase reveal hanya untuk jawaban terkonfirmasi server", () => {
    const fnStart = projectorSource.indexOf(
      "const handleRecordAnswer = useCallback(",
    );
    assert.ok(fnStart >= 0);
    const guardPos = projectorSource.indexOf(
      '!(serverConfirmed && phase === "reveal")',
      fnStart,
    );
    assert.ok(guardPos > fnStart);
    // Penjaga basi dan penjaga duplikat tetap sesudah pintu fase:
    const stalePos = projectorSource.indexOf("isAnswerEventStale(", guardPos);
    const markPos = projectorSource.indexOf(
      "tryMarkRecordedAnswer(",
      guardPos,
    );
    assert.ok(stalePos > guardPos);
    assert.ok(markPos > stalePos);
  });

  test("Route hanya mengirim answeredTeams kepada pemanggil terautentikasi", () => {
    const authPos = routeSource.indexOf("viewerIsAuthenticated");
    assert.ok(authPos >= 0);
    assert.ok(routeSource.includes("supabase.auth.getUser()"));
    const spreadPos = routeSource.indexOf(
      "answeredTeams: gs.answeredTeams",
    );
    assert.ok(spreadPos > authPos);
    // Hitungan tetap tersedia untuk semua pemanggil seperti sebelumnya:
    assert.ok(
      routeSource.includes(
        "answeredCount: Object.keys(gs.answeredTeams).length",
      ),
    );
  });
});
