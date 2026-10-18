import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeQuestionForClient,
  buildProjectorSnapshot,
  computeWorldStateFromCheckpoint,
  getSouqFishingEngineMetadata,
  getSouqFishingGameDefinition,
} from "../../bridge/magguru-bridge";
import { createInitialWorldState } from "../../engine/world";

describe("Phase 5 Integration: Magguru Bridge Suite", () => {
  it("sanitizes questions by stripping correctOptionId, correct_option_id, and explanation", () => {
    const rawQuestion = {
      id: "q-101",
      position: 1,
      questionText: "ما هذا؟ (Apa ini?)",
      difficulty: "medium",
      correctOptionId: "opt-1",
      correct_option_id: "opt-1",
      correctOptionKey: "A",
      correct_option_key: "A",
      explanation: "هذا سمك (Ini adalah ikan)",
      isCorrect: true,
      is_correct: true,
      options: [
        { id: "opt-1", optionKey: "A", optionText: "سَمَكٌ", isCorrect: true, is_correct: true },
        { id: "opt-2", optionKey: "B", optionText: "تُفَّاحٌ", isCorrect: false, is_correct: false },
      ],
    };

    const sanitized = sanitizeQuestionForClient(rawQuestion);

    assert.equal(sanitized.id, "q-101");
    assert.equal(sanitized.questionText, "ما هذا؟ (Apa ini?)");
    assert.equal("correctOptionId" in sanitized, false);
    assert.equal("correct_option_id" in sanitized, false);
    assert.equal("correctOptionKey" in sanitized, false);
    assert.equal("correct_option_key" in sanitized, false);
    assert.equal("explanation" in sanitized, false);
    assert.equal("isCorrect" in sanitized, false);
    assert.equal("is_correct" in sanitized, false);

    const opts = sanitized.options as Array<Record<string, unknown>>;
    assert.equal(opts.length, 2);
    assert.equal("isCorrect" in opts[0], false);
    assert.equal("is_correct" in opts[0], false);
    assert.equal("isCorrect" in opts[1], false);
    assert.equal("is_correct" in opts[1], false);
  });

  it("buildProjectorSnapshot produces valid WorldState from a mock room object", () => {
    const mockRoom = {
      id: "room-abc-123",
      room_code: "PASAR1",
      snapshot: {
        game_theme: "souq_fishing",
        questions: [{ id: "q-1" }],
      },
    };

    const world = buildProjectorSnapshot(mockRoom);

    assert.ok(world);
    assert.equal(typeof world.tick, "number");
    assert.ok(world.teams.MERAH);
    assert.ok(world.teams.BIRU);
    assert.ok(world.teams.KUNING);
    assert.ok(world.teams.HIJAU);
    assert.equal(world.teams.MERAH.location, "ALUN");
    assert.equal(world.teams.MERAH.zone, "PASAR");
  });

  it("computeWorldStateFromCheckpoint recovers state from valid checkpoint envelope", () => {
    const initial = createInitialWorldState();
    const modifiedTeams = {
      ...initial.teams,
      MERAH: {
        ...initial.teams.MERAH,
        points: 450,
        location: "DERMAGA_1" as const,
        zone: "DERMAGA" as const,
      },
    };

    const checkpoint = {
      version: 1,
      updated_at: new Date().toISOString(),
      teams: modifiedTeams,
      tick: 42,
    };

    const recovered = computeWorldStateFromCheckpoint(checkpoint);

    assert.equal(recovered.tick, 42);
    assert.equal(recovered.teams.MERAH.points, 450);
    assert.equal(recovered.teams.MERAH.location, "DERMAGA_1");
    assert.equal(recovered.teams.MERAH.zone, "DERMAGA");
    assert.equal(recovered.teams.BIRU.points, 0);
  });

  it("computeWorldStateFromCheckpoint returns clean initial WorldState if checkpoint is null or corrupt", () => {
    const nullRecovered = computeWorldStateFromCheckpoint(null);
    assert.ok(nullRecovered);
    assert.equal(nullRecovered.teams.MERAH.points, 0);
    assert.equal(nullRecovered.teams.MERAH.location, "ALUN");

    const undefinedRecovered = computeWorldStateFromCheckpoint(undefined);
    assert.equal(undefinedRecovered.teams.BIRU.points, 0);

    const corruptRecovered = computeWorldStateFromCheckpoint({ corrupted: true, garbage: "123" });
    assert.ok(corruptRecovered);
    assert.equal(corruptRecovered.teams.KUNING.points, 0);
    assert.equal(corruptRecovered.teams.KUNING.location, "ALUN");
  });

  it("getSouqFishingEngineMetadata and getSouqFishingGameDefinition return valid Magguru metadata", () => {
    const meta = getSouqFishingEngineMetadata("id");
    assert.equal(meta.id, "souq_fishing");
    assert.ok(meta.name);
    assert.equal(meta.icon, "🎣");

    const def = getSouqFishingGameDefinition();
    assert.equal(def.id, "souq_fishing");
    assert.equal(def.capabilities.hasLanes, true);
    assert.equal(def.capabilities.supportsArabicRTL, true);
  });
});
