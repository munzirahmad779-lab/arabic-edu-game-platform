import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GameRegistry } from "@/lib/game-engine/registry";

describe("Phase 5 Integration: Game Engine Registry Integration Suite", () => {
  it("GameRegistry is isolated and does not collide with standalone souq-fishing", () => {
    assert.equal(GameRegistry.resolve("souq_fishing"), "quiz");
    const def = GameRegistry.get("quiz");
    assert.equal(def.id, "quiz");
  });

  it("GameRegistry.get('quiz') remains identical to original baseline definition", () => {
    const quizDef = GameRegistry.get("quiz");
    assert.equal(quizDef.id, "quiz");
    assert.equal(quizDef.nameKey, "game_quiz_title");
    assert.equal(quizDef.icon, "📝");
    assert.equal(quizDef.accentColor, "sky");
    assert.equal(quizDef.defaultDifficulty, "easy");
    assert.deepEqual(quizDef.capabilities.supportedModes, [
      "competitive",
      "cooperative",
      "practice",
      "endless",
    ]);
  });

  it("All legacy games (runner, matching, penalty, anagram, kahoot, millionaire) remain unchanged", () => {
    const runnerDef = GameRegistry.get("runner");
    assert.equal(runnerDef.id, "runner");
    assert.equal(runnerDef.icon, "🏃‍♂️");
    assert.equal(runnerDef.capabilities.hasLanes, true);

    const matchingDef = GameRegistry.get("matching");
    assert.equal(matchingDef.id, "matching");
    assert.equal(matchingDef.icon, "🧩");

    const penaltyDef = GameRegistry.get("penalty");
    assert.equal(penaltyDef.id, "penalty");
    assert.equal(penaltyDef.icon, "⚽");

    const anagramDef = GameRegistry.get("anagram");
    assert.equal(anagramDef.id, "anagram");
    assert.equal(anagramDef.icon, "🔤");

    const kahootDef = GameRegistry.get("kahoot");
    assert.equal(kahootDef.id, "kahoot");
    assert.equal(kahootDef.icon, "▲");

    const millionaireDef = GameRegistry.get("millionaire");
    assert.equal(millionaireDef.id, "millionaire");
    assert.equal(millionaireDef.icon, "💰");
  });

  it("GameRegistry.resolve properly maps game type and mode strings", () => {
    assert.equal(GameRegistry.resolve("runner"), "runner");
    assert.equal(GameRegistry.resolve("matching"), "matching");
    assert.equal(GameRegistry.resolve("penalty"), "penalty");
    assert.equal(GameRegistry.resolve("arabic_chase_race", "speed_run"), "runner");
    assert.equal(GameRegistry.resolve(null, null), "quiz");
  });
});
