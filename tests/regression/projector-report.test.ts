import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProjectorReportPayload } from "../../src/lib/projector-report";

test("tim diurutkan skor desc, rank 1-based, anggota ikut terbawa", () => {
  const payload = buildProjectorReportPayload({
    gameId: "0ab78502-a35a-4fec-95c6-5b6f48a39b08",
    gameName: "Campuran Fokus Dars 3",
    classId: "kelas-1",
    roomCode: "ABC234",
    totalQuestions: 20,
    teams: [
      { id: "team-2", name: "Tim Biru", score: 120, correctCount: 9, members: [] },
      {
        id: "team-1",
        name: "Tim Merah",
        score: 300,
        correctCount: 15,
        members: [{ id: "s1", name: "Budi" }],
      },
    ],
  });
  assert.equal(payload.teams[0]?.name, "Tim Merah");
  assert.equal(payload.teams[0]?.rank, 1);
  assert.equal(payload.teams[1]?.rank, 2);
  assert.deepEqual(payload.teams[0]?.members, [{ id: "s1", name: "Budi" }]);
  assert.equal(payload.targetRounds, 20);
  assert.equal(payload.classId, "kelas-1");
  assert.equal(payload.gameId, "0ab78502-a35a-4fec-95c6-5b6f48a39b08");
});

test("kelas semu room-online dan gameId uji tidak disertakan", () => {
  const payload = buildProjectorReportPayload({
    gameId: "test-123",
    gameName: "Uji",
    classId: "room-online",
    roomCode: "HOTSEAT",
    totalQuestions: 0,
    teams: [{ id: "arcade-run", name: "Pesawat Terbang Awan", score: 500, correctCount: 4 }],
  });
  assert.equal(payload.gameId, undefined);
  assert.equal(payload.classId, undefined);
  assert.equal(payload.targetRounds, 1);
  assert.equal(payload.teams[0]?.rank, 1);
});
