/**
 * Regression: kunci jawaban dikarang + leaderboard memori mengalahkan RPC
 * (temuan uji matriks gameplay, 29 Okt 2026).
 *
 * Akar masalah:
 * 1. normalizeSnapshotQuestion memberi default correct_option_key "A" untuk
 *    soal yang memang tidak membawa kunci (RPC get_game_session menyembunyikan
 *    kunci dari siswa secara sengaja). Penilaian cadangan di ActiveRoomStore
 *    lalu menganggap jawaban berkunci A selalu benar dan kunci lain selalu
 *    salah, dan payload sesi ikut mengirim "kunci" karangan itu ke siswa.
 * 2. /api/rooms/leaderboard mendahulukan store memori per-instance di atas
 *    RPC database, sehingga siswa melihat correct_count, final_score, dan
 *    jumlah peserta yang menyimpang dari data otoritatif guru.
 *
 * Perbaikan:
 * - Default kunci yang tidak dikenal adalah "" (tidak bisa menilai).
 * - Route leaderboard mengutamakan RPC; store hanya cadangan.
 * - Route sesi menyaring correct_option_key dari setiap soal yang keluar.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeSnapshotQuestion } from "../../src/lib/game-engine/room-store";

const root = process.cwd();
const leaderboardRoute = readFileSync(
  path.join(root, "src/app/api/rooms/leaderboard/route.ts"),
  "utf8",
);
const sessionRoute = readFileSync(
  path.join(root, "src/app/api/rooms/session/route.ts"),
  "utf8",
);
const migration0072 = readFileSync(
  path.join(root, "supabase/migrations/0072_calculate_question_score.sql"),
  "utf8",
);

describe("normalizeSnapshotQuestion tidak mengarang kunci jawaban", () => {
  test("soal tanpa correct_option_key menghasilkan kunci kosong", () => {
    const q = normalizeSnapshotQuestion(
      {
        id: "q-1",
        question_text: "Ibu kota Indonesia adalah?",
        difficulty: "easy",
        options: [
          { id: "o1", option_key: "A", option_text: "Jakarta" },
          { id: "o2", option_key: "B", option_text: "Bandung" },
        ],
      },
      0,
    );
    assert.ok(q);
    assert.equal(q.correct_option_key, "");
  });

  test("kunci asli dari snapshot dipertahankan apa adanya", () => {
    const q = normalizeSnapshotQuestion(
      {
        position: 3,
        question: {
          id: "q-3",
          question_text: "Warna langit?",
          difficulty: "easy",
          correct_option_key: "b",
          options: [
            { id: "o1", option_key: "A", option_text: "Hijau" },
            { id: "o2", option_key: "B", option_text: "Biru" },
          ],
        },
      },
      2,
    );
    assert.ok(q);
    assert.equal(q.correct_option_key, "B");
  });
});

describe("route leaderboard & sesi menjaga jalur otoritatif", () => {
  test("leaderboard memanggil RPC sebelum store memori", () => {
    const rpcIdx = leaderboardRoute.indexOf("get_room_leaderboard_student");
    const storeIdx = leaderboardRoute.indexOf("ActiveRoomStore.getByToken");
    assert.ok(rpcIdx >= 0 && storeIdx >= 0);
    assert.ok(rpcIdx < storeIdx, "RPC harus didahulukan dari store");
  });

  test("sesi menyaring kunci jawaban dari soal yang dikirim ke siswa", () => {
    assert.ok(sessionRoute.includes("toPublicQuestion"));
    assert.ok(sessionRoute.includes("delete copy.correct_option_key"));
  });
});

describe("migrasi 0072 mendefinisikan calculate_question_score", () => {
  test("fungsi didefinisikan dengan semantik bobot difficulty", () => {
    assert.ok(
      migration0072.includes(
        "create or replace function public.calculate_question_score",
      ),
    );
    assert.ok(migration0072.includes("game_weight_for_difficulty"));
  });
});
