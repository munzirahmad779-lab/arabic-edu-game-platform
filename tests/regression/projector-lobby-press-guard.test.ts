/**
 * Regresi: jawaban stik yang tercatat di store bersama SEBELUM kuis
 * dimulai terbawa melewati reset startGame pada indeks 0 (temuan
 * armada K35, audit 6 Nov 2026; reproduksi armada 3 kali identik).
 *
 * Akar masalah: applyPressToRoomData (TS) dan RPC press_projector_button
 * (SQL 0078) sama-sama hanya memeriksa indeks soal, tidak memeriksa
 * fase. Room yang belum dimulai berfase "lobby" dengan indeks 0, jadi
 * press berindeks 0 di lobi lolos penjaga indeks dan tercatat sebagai
 * jawaban. Saat guru menekan MULAI, sync startGame (fase question,
 * indeks 0, indeks sama) menggabungkan answeredTeams secara union,
 * sehingga jawaban pra-mulai itu terbawa ke soal pertama dan stik tim
 * terkait terkunci sebelum soal pertama dibacakan. Jalur masuknya:
 * press API langsung atau state basi sesi sebelumnya di dalam TTL
 * 60 detik (UI stik normal memang menolak press di luar fase question,
 * tetapi store tidak boleh bergantung pada kesopanan klien).
 *
 * Perilaku yang dikunci di sini:
 * 1. Press hanya tercatat selama fase "question". Press pada fase
 *    lobby/reveal/leaderboard/finished ditolak STALE_QUESTION tanpa
 *    mencatat jawaban atau event; heartbeat tetap dicatat (kehadiran
 *    dan perilaku sah lain tidak berubah).
 * 2. Transisi sync masuk fase "question" dari fase bukan question pada
 *    indeks yang sama (mulai permainan dari lobi) TIDAK menggabungkan
 *    jawaban lama: jawaban yang terlanjur tersimpan sebelum mulai
 *    (misalnya oleh RPC lama sebelum migrasi 0081) gugur di pintu
 *    mulai, bukan terbawa ke soal pertama.
 * 3. Sesudah mulai, tim yang press lobi-nya ditolak TIDAK terkunci:
 *    press sah pertamanya pada soal 0 tercatat normal.
 *
 * Paritas SQL: draf migrasi 0081 (di luar repo produksi, berkas
 * draf-migrasi-0081-penjaga-fase-store.sql) menerapkan penjaga yang
 * sama di RPC press_projector_button dan aturan transisi yang sama di
 * RPC sync_projector_room_state.
 */

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyPressToRoomData,
  buildSyncedGameState,
  createDefaultProjectorRoomData,
  fetchProjectorRoomData,
  getProjectorRoomData,
  pressProjectorButton,
  syncProjectorGameState,
} from "../../src/lib/game-engine/projector-controller-store";

// Mode fallback in-memory, pola yang sama dengan suite store bersama:
// logika penjaga diuji tanpa database; jalur Supabase menerapkan
// semantik yang sama di SQL (draf migrasi 0081).
const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const savedAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

after(() => {
  if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  if (savedAnon !== undefined)
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnon;
});

const NOW = 1_700_000_100_000;

describe("Penjaga fase store proyektor (jawaban sebelum mulai)", () => {
  test("Press pada fase lobi berindeks 0 ditolak: tidak tercatat, tanpa event, heartbeat tetap ada", () => {
    const data = createDefaultProjectorRoomData(NOW);
    assert.equal(data.gameState.phase, "lobby");
    const result = applyPressToRoomData(
      data,
      "UJI-LOBI",
      { teamId: "team-1", playerName: "Merah", optionKey: "A", questionIndex: 0 },
      NOW + 10,
    );
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error, "STALE_QUESTION");
      assert.equal(result.existingAnswer, null);
    }
    assert.deepEqual(data.gameState.answeredTeams, {});
    assert.equal(data.events.length, 0);
    // Kehadiran tidak berubah: heartbeat press yang ditolak tetap dicatat
    assert.equal(data.heartbeats["team-1"], NOW + 10);
  });

  test("Press pada fase reveal, leaderboard, dan finished dengan indeks cocok juga ditolak", () => {
    for (const phase of ["reveal", "leaderboard", "finished"] as const) {
      const data = createDefaultProjectorRoomData(NOW);
      data.gameState.phase = phase;
      data.gameState.currentQuestionIndex = 2;
      const result = applyPressToRoomData(
        data,
        "UJI-LOBI",
        { teamId: "team-2", playerName: "Biru", optionKey: "C", questionIndex: 2 },
        NOW + 20,
      );
      assert.equal(result.success, false, `fase ${phase} harus menolak press`);
      assert.deepEqual(data.gameState.answeredTeams, {});
      assert.equal(data.events.length, 0);
      assert.equal(data.heartbeats["team-2"], NOW + 20);
    }
  });

  test("SKENARIO ARMADA K35: press lobi tidak terbawa startGame; tim tidak terkunci di soal pertama", async () => {
    const code = "UJI-LOBI-ASYNC";

    // Siswa menekan tombol sebelum kuis dimulai. Room belum pernah
    // disync proyektor, jadi store membacanya sebagai room bawaan
    // berfase lobi indeks 0: persis keadaan reproduksi armada.
    const early = await pressProjectorButton(code, {
      teamId: "team-1",
      playerName: "Merah",
      optionKey: "B",
      questionIndex: 0,
    });
    assert.equal(early.success, false);
    if (!early.success) assert.equal(early.error, "STALE_QUESTION");

    // Guru menekan MULAI: sync startGame persis pola route (ambil state
    // tersimpan, bangun target fase question indeks 0 dengan jawaban
    // bersih, lalu sync).
    const prev = await fetchProjectorRoomData(code);
    assert.ok(prev);
    const started = buildSyncedGameState(
      prev.gameState,
      {
        phase: "question",
        currentQuestionIndex: 0,
        totalQuestions: 30,
        answeredTeams: {},
      },
      Date.now(),
    );
    await syncProjectorGameState(code, started);

    const afterStart = await fetchProjectorRoomData(code);
    assert.ok(afterStart);
    assert.equal(afterStart.gameState.phase, "question");
    assert.deepEqual(afterStart.gameState.answeredTeams, {});

    // Tim yang sama menjawab soal pertama secara sah: harus tercatat,
    // membuktikan penolakan lobi tidak mengunci tim.
    const legit = await pressProjectorButton(code, {
      teamId: "team-1",
      playerName: "Merah",
      optionKey: "D",
      questionIndex: 0,
    });
    assert.equal(legit.success, true);
    const finalData = await fetchProjectorRoomData(code);
    assert.ok(finalData);
    assert.equal(finalData.gameState.answeredTeams["team-1"].optionKey, "D");
  });

  test("Jawaban pra-mulai yang terlanjur tersimpan (warisan RPC lama) gugur pada transisi lobi ke question indeks sama", async () => {
    const code = "UJI-LOBI-WARISAN";

    // Tanam keadaan warisan langsung ke store: fase lobi, indeks 0,
    // answeredTeams sudah terisi seolah press lobi sempat tercatat oleh
    // jalur lama sebelum penjaga fase ada.
    const planted = getProjectorRoomData(code);
    planted.gameState.phase = "lobby";
    planted.gameState.currentQuestionIndex = 0;
    planted.gameState.answeredTeams = {
      "team-3": { optionKey: "A", timestamp: NOW },
    };

    const prev = await fetchProjectorRoomData(code);
    assert.ok(prev);
    const started = buildSyncedGameState(
      prev.gameState,
      { phase: "question", currentQuestionIndex: 0, answeredTeams: {} },
      Date.now(),
    );
    // Union biasa akan mempertahankan team-3; transisi mulai tidak boleh.
    assert.deepEqual(started.answeredTeams, {});

    await syncProjectorGameState(code, started);
    const afterStart = await fetchProjectorRoomData(code);
    assert.ok(afterStart);
    assert.deepEqual(afterStart.gameState.answeredTeams, {});
  });

  test("Kontrol: transisi question ke reveal pada indeks sama tetap mempertahankan jawaban sah", () => {
    const prev = createDefaultProjectorRoomData(NOW).gameState;
    prev.phase = "question";
    prev.currentQuestionIndex = 4;
    prev.answeredTeams = { "team-2": { optionKey: "C", timestamp: NOW } };
    const revealed = buildSyncedGameState(
      prev,
      { phase: "reveal", answeredTeams: {} },
      NOW + 1000,
    );
    assert.deepEqual(revealed.answeredTeams, {
      "team-2": { optionKey: "C", timestamp: NOW },
    });
  });
});
