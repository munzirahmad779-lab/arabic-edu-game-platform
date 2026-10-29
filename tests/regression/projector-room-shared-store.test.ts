import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyPressToRoomData,
  buildSyncedGameState,
  createDefaultProjectorRoomData,
  fetchProjectorRoomData,
  getProjectorRoomData,
  isProjectorRoomActiveShared,
  isProjectorRoomExpired,
  mergeAnsweredTeamsForSync,
  pressProjectorButton,
  syncProjectorGameState,
  PROJECTOR_ROOM_TTL_MS,
  type ProjectorGameState,
} from "../../src/lib/game-engine/projector-controller-store";

// Paksa mode fallback in-memory: fungsi async store memakai Map lokal bila
// env Supabase tidak tersedia, sehingga logika merge dan kedaluwarsa dapat
// diuji tanpa database. Runner menjalankan tiap berkas tes di proses
// terpisah, jadi penghapusan env di sini tidak memengaruhi suite lain.
// Jalur Supabase (RPC migrasi 0078) menerapkan semantik yang sama di SQL.
const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const savedAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

after(() => {
  if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  if (savedAnon !== undefined)
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedAnon;
});

const NOW = 1_700_000_000_000;

function gameState(partial: Partial<ProjectorGameState>): ProjectorGameState {
  return { ...createDefaultProjectorRoomData(NOW).gameState, ...partial };
}

describe("Store Bersama Room Proyektor (Migrasi 0078)", () => {
  describe("Merge answeredTeams untuk sync proyektor", () => {
    test("Indeks sama: union mempertahankan jawaban server dan payload menang per tim", () => {
      const previous = {
        "team-1": { optionKey: "A", timestamp: 100 },
        "team-2": { optionKey: "B", timestamp: 200 },
      };
      const incoming = {
        "team-2": { optionKey: "C", timestamp: 300 },
        "team-3": { optionKey: "D", timestamp: 400 },
      };
      const merged = mergeAnsweredTeamsForSync(previous, incoming, true);
      assert.deepEqual(merged, {
        "team-1": { optionKey: "A", timestamp: 100 },
        "team-2": { optionKey: "C", timestamp: 300 },
        "team-3": { optionKey: "D", timestamp: 400 },
      });
    });

    test("Indeks sama tanpa payload jawaban: jawaban server dipertahankan", () => {
      const previous = { "team-1": { optionKey: "A", timestamp: 100 } };
      const merged = mergeAnsweredTeamsForSync(previous, undefined, true);
      assert.deepEqual(merged, previous);
    });

    test("Indeks baru: payload menggantikan, dan tanpa payload menjadi kosong", () => {
      const previous = { "team-1": { optionKey: "A", timestamp: 100 } };
      const incoming = { "team-9": { optionKey: "B", timestamp: 500 } };
      assert.deepEqual(mergeAnsweredTeamsForSync(previous, incoming, false), {
        "team-9": { optionKey: "B", timestamp: 500 },
      });
      assert.deepEqual(mergeAnsweredTeamsForSync(previous, undefined, false), {});
    });
  });

  describe("buildSyncedGameState", () => {
    test("Kolom yang tidak dikirim payload diwarisi dari state sebelumnya", () => {
      const prev = gameState({
        phase: "question",
        currentQuestionIndex: 3,
        timerSeconds: 42,
        totalQuestions: 10,
        questionText: "Soal lama",
      });
      const next = buildSyncedGameState(prev, { phase: "reveal" }, NOW + 1000);
      assert.equal(next.phase, "reveal");
      assert.equal(next.currentQuestionIndex, 3);
      assert.equal(next.timerSeconds, 42);
      assert.equal(next.totalQuestions, 10);
      assert.equal(next.questionText, "Soal lama");
      assert.equal(next.lastUpdated, NOW + 1000);
    });

    test("Ganti indeks soal mengosongkan jawaban; indeks sama menggabungkan", () => {
      const prev = gameState({
        currentQuestionIndex: 0,
        answeredTeams: { "team-1": { optionKey: "A", timestamp: 1 } },
      });
      const sameIndex = buildSyncedGameState(prev, { answeredTeams: {} }, NOW);
      assert.deepEqual(sameIndex.answeredTeams, {
        "team-1": { optionKey: "A", timestamp: 1 },
      });
      const newIndex = buildSyncedGameState(
        prev,
        { currentQuestionIndex: 1 },
        NOW,
      );
      assert.deepEqual(newIndex.answeredTeams, {});
    });
  });

  describe("applyPressToRoomData", () => {
    test("Press pertama tercatat, terkunci, heartbeat dan event terisi", () => {
      const data = createDefaultProjectorRoomData(NOW);
      const result = applyPressToRoomData(
        data,
        "uji-press",
        { teamId: "team-1", playerName: "Yaya", optionId: null, optionKey: "b", questionIndex: 0 },
        NOW + 10,
      );
      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.optionKey, "B");
        assert.equal(result.timestamp, NOW + 10);
        assert.ok(result.eventId.startsWith(`evt-${NOW + 10}-`));
      }
      assert.deepEqual(data.gameState.answeredTeams["team-1"], {
        optionKey: "B",
        timestamp: NOW + 10,
      });
      assert.equal(data.heartbeats["team-1"], NOW + 10);
      assert.equal(data.events.length, 1);
      assert.equal(data.events[0].optionKey, "B");
    });

    test("Press kedua tim yang sama ditolak ALREADY_ANSWERED dan jawaban tidak berubah", () => {
      const data = createDefaultProjectorRoomData(NOW);
      applyPressToRoomData(
        data,
        "UJI-PRESS",
        { teamId: "team-1", playerName: "Yaya", optionKey: "A", questionIndex: 0 },
        NOW,
      );
      const second = applyPressToRoomData(
        data,
        "UJI-PRESS",
        { teamId: "team-1", playerName: "Yaya", optionKey: "D", questionIndex: 0 },
        NOW + 5000,
      );
      assert.equal(second.success, false);
      if (!second.success) {
        assert.equal(second.error, "ALREADY_ANSWERED");
        assert.equal(second.existingAnswer, "A");
      }
      assert.equal(data.gameState.answeredTeams["team-1"].optionKey, "A");
      // Heartbeat tetap diperbarui walau press ditolak (paritas route lama)
      assert.equal(data.heartbeats["team-1"], NOW + 5000);
      assert.equal(data.events.length, 1);
    });

    test("Tim lain tetap bisa menjawab; optionKey kosong menjadi A", () => {
      const data = createDefaultProjectorRoomData(NOW);
      applyPressToRoomData(
        data,
        "UJI-PRESS",
        { teamId: "team-1", playerName: "Yaya", optionKey: "C", questionIndex: 0 },
        NOW,
      );
      const other = applyPressToRoomData(
        data,
        "UJI-PRESS",
        { teamId: "team-2", playerName: "Siddiq", questionIndex: 0 },
        NOW + 1,
      );
      assert.equal(other.success, true);
      assert.equal(data.gameState.answeredTeams["team-2"].optionKey, "A");
    });
  });

  describe("Penjaga jawaban hantu (indeks soal pada press)", () => {
    function roomAtIndex(index: number) {
      const data = createDefaultProjectorRoomData(NOW);
      data.gameState.phase = "question";
      data.gameState.currentQuestionIndex = index;
      return data;
    }

    test("Press dengan indeks cocok pada indeks bukan nol tercatat", () => {
      const data = roomAtIndex(3);
      const result = applyPressToRoomData(
        data,
        "UJI-HANTU",
        { teamId: "team-4", playerName: "Kuning", optionKey: "A", questionIndex: 3 },
        NOW + 10,
      );
      assert.equal(result.success, true);
      assert.deepEqual(data.gameState.answeredTeams["team-4"], {
        optionKey: "A",
        timestamp: NOW + 10,
      });
      assert.equal(data.events.length, 1);
    });

    test("Press basi (indeks N-1 saat room di N) ditolak STALE_QUESTION: tidak tercatat, tim tidak terkunci, tanpa event", () => {
      const data = roomAtIndex(3);
      const result = applyPressToRoomData(
        data,
        "UJI-HANTU",
        { teamId: "team-4", playerName: "Kuning", optionKey: "A", questionIndex: 2 },
        NOW + 20,
      );
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error, "STALE_QUESTION");
        assert.equal(result.existingAnswer, null);
      }
      assert.deepEqual(data.gameState.answeredTeams, {});
      assert.equal(data.events.length, 0);
      // Heartbeat tetap dicatat walau press ditolak (paritas ALREADY_ANSWERED)
      assert.equal(data.heartbeats["team-4"], NOW + 20);
    });

    test("Press indeks masa depan (N+1 saat room di N) ditolak dan tidak tercatat", () => {
      const data = roomAtIndex(3);
      const result = applyPressToRoomData(
        data,
        "UJI-HANTU",
        { teamId: "team-4", playerName: "Kuning", optionKey: "B", questionIndex: 4 },
        NOW + 30,
      );
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "STALE_QUESTION");
      assert.deepEqual(data.gameState.answeredTeams, {});
      assert.equal(data.events.length, 0);
    });

    test("Press tanpa indeks soal ditolak STALE_QUESTION", () => {
      const data = roomAtIndex(0);
      const result = applyPressToRoomData(
        data,
        "UJI-HANTU",
        { teamId: "team-1", playerName: "Yaya", optionKey: "A" },
        NOW + 40,
      );
      assert.equal(result.success, false);
      if (!result.success) assert.equal(result.error, "STALE_QUESTION");
      assert.deepEqual(data.gameState.answeredTeams, {});
    });

    test("Skenario K14 lewat API async: duplikat press soal lama yang tiba sesudah room maju tidak menjadi jawaban hantu", async () => {
      const code = "UJI-HANTU-ASYNC";
      const first = await pressProjectorButton(code, {
        teamId: "team-4",
        playerName: "Kuning",
        optionKey: "A",
        questionIndex: 0,
      });
      assert.equal(first.success, true);

      // Proyektor maju ke soal berikutnya (indeks 1), jawaban dibersihkan
      const before = await fetchProjectorRoomData(code);
      assert.ok(before);
      const advanced = buildSyncedGameState(
        before.gameState,
        { phase: "question", currentQuestionIndex: 1 },
        Date.now(),
      );
      await syncProjectorGameState(code, advanced);

      // Pengiriman ulang press soal 0 yang terlambat tiba sekarang
      const late = await pressProjectorButton(code, {
        teamId: "team-4",
        playerName: "Kuning",
        optionKey: "A",
        questionIndex: 0,
      });
      assert.equal(late.success, false);
      if (!late.success) assert.equal(late.error, "STALE_QUESTION");

      const after = await fetchProjectorRoomData(code);
      assert.ok(after);
      assert.deepEqual(after.gameState.answeredTeams, {});

      // Tim tidak terkunci oleh penolakan itu: press segar soal berjalan lolos
      const fresh = await pressProjectorButton(code, {
        teamId: "team-4",
        playerName: "Kuning",
        optionKey: "D",
        questionIndex: 1,
      });
      assert.equal(fresh.success, true);
      const finalData = await fetchProjectorRoomData(code);
      assert.ok(finalData);
      assert.equal(finalData.gameState.answeredTeams["team-4"].optionKey, "D");
    });
  });

  describe("Kedaluwarsa room (TTL 60 detik)", () => {
    test("Batas TTL: sebelum ambang masih aktif, pada ambang sudah kedaluwarsa", () => {
      assert.equal(
        isProjectorRoomExpired(NOW, NOW + PROJECTOR_ROOM_TTL_MS - 1),
        false,
      );
      assert.equal(isProjectorRoomExpired(NOW, NOW + PROJECTOR_ROOM_TTL_MS), true);
      assert.equal(
        isProjectorRoomExpired(NOW, NOW + PROJECTOR_ROOM_TTL_MS * 10),
        true,
      );
    });
  });

  describe("Alur store bersama (mode fallback in-memory)", () => {
    test("Kode yang belum pernah ditulis tidak aktif", async () => {
      assert.equal(await isProjectorRoomActiveShared("UJI-BELUM-ADA"), false);
    });

    test("Press lewat API async tercatat dan room menjadi aktif", async () => {
      const result = await pressProjectorButton("uji-shared-a", {
        teamId: "team-1",
        playerName: "Yaya",
        optionKey: "C",
        questionIndex: 0,
      });
      assert.equal(result.success, true);
      const data = await fetchProjectorRoomData("UJI-SHARED-A");
      assert.ok(data);
      assert.equal(data.gameState.answeredTeams["team-1"].optionKey, "C");
      assert.equal(await isProjectorRoomActiveShared("UJI-SHARED-A"), true);
    });

    test("Sync sesudah press tidak menghapus jawaban press pada indeks yang sama", async () => {
      const code = "UJI-SHARED-B";
      await pressProjectorButton(code, {
        teamId: "team-3",
        playerName: "Anya",
        optionKey: "D",
        questionIndex: 0,
      });
      const before = await fetchProjectorRoomData(code);
      assert.ok(before);

      // Proyektor yang belum melihat press ini mengirim sync tanpa team-3
      const target = buildSyncedGameState(
        before.gameState,
        { phase: "reveal", answeredTeams: {} },
        Date.now(),
      );
      await syncProjectorGameState(code, target);

      const after1 = await fetchProjectorRoomData(code);
      assert.ok(after1);
      assert.equal(after1.gameState.phase, "reveal");
      assert.equal(after1.gameState.answeredTeams["team-3"].optionKey, "D");

      // Pindah soal: jawaban soal lama bersih
      const nextTarget = buildSyncedGameState(
        after1.gameState,
        { phase: "question", currentQuestionIndex: 1 },
        Date.now(),
      );
      await syncProjectorGameState(code, nextTarget);
      const after2 = await fetchProjectorRoomData(code);
      assert.ok(after2);
      assert.deepEqual(after2.gameState.answeredTeams, {});
      assert.equal(getProjectorRoomData(code).gameState.currentQuestionIndex, 1);
    });
  });
});
