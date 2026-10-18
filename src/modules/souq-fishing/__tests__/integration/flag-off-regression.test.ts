import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSouqFishingEnabled } from "../../bridge/magguru-bridge";
import { GameRegistry } from "@/lib/game-engine/registry";

describe("Phase 5 Integration: Flag-OFF Production Regression Suite", () => {
  it("when flag is OFF, isSouqFishingEnabled returns false", () => {
    const disabled = isSouqFishingEnabled({
      ENABLE_SOUQ_FISHING_MODULE: "false",
      NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE: "false",
    });
    assert.equal(disabled, false);
  });

  it("when flag is OFF, GameRegistry.getAll() returns only original 15 definitions without souq_fishing", () => {
    // With flag disabled in process.env
    const prevFlag = process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE;
    const prevFlag2 = process.env.ENABLE_SOUQ_FISHING_MODULE;
    try {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = "false";
      process.env.ENABLE_SOUQ_FISHING_MODULE = "false";

      const all = GameRegistry.getAll();
      assert.equal(all.length, 15);
      const hasSouq = all.some((d) => (d.id as string) === "souq_fishing");
      assert.equal(hasSouq, false);
    } finally {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = prevFlag;
      process.env.ENABLE_SOUQ_FISHING_MODULE = prevFlag2;
    }
  });

  it("when flag is OFF, GameRegistry.resolve('souq_fishing') falls back to 'quiz'", () => {
    const prevFlag = process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE;
    const prevFlag2 = process.env.ENABLE_SOUQ_FISHING_MODULE;
    try {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = "false";
      process.env.ENABLE_SOUQ_FISHING_MODULE = "false";

      const resolved = GameRegistry.resolve("souq_fishing");
      assert.equal(resolved, "quiz");

      const def = GameRegistry.get("souq_fishing");
      assert.equal(def.id, "quiz");
    } finally {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = prevFlag;
      process.env.ENABLE_SOUQ_FISHING_MODULE = prevFlag2;
    }
  });

  it("when flag is OFF, legacy game capabilities and default difficulties remain intact", () => {
    const prevFlag = process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE;
    const prevFlag2 = process.env.ENABLE_SOUQ_FISHING_MODULE;
    try {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = "false";
      process.env.ENABLE_SOUQ_FISHING_MODULE = "false";

      assert.equal(GameRegistry.isModeSupported("runner", "competitive"), true);
      assert.equal(GameRegistry.isModeSupported("runner", "cooperative"), false);
      assert.equal(GameRegistry.isModeSupported("quiz", "cooperative"), true);
      assert.equal(GameRegistry.isModeSupported("matching", "practice"), true);
    } finally {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = prevFlag;
      process.env.ENABLE_SOUQ_FISHING_MODULE = prevFlag2;
    }
  });

  it("when flag is OFF, no souq-fishing side effects leak into core platform operations", () => {
    const prevFlag = process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE;
    const prevFlag2 = process.env.ENABLE_SOUQ_FISHING_MODULE;
    try {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = "false";
      process.env.ENABLE_SOUQ_FISHING_MODULE = "false";

      assert.equal(isSouqFishingEnabled(), false);
      assert.equal(GameRegistry.resolve("kahoot"), "kahoot");
      assert.equal(GameRegistry.resolve("whack_mole"), "whack_mole");
      assert.equal(GameRegistry.resolve("wordle"), "wordle");
    } finally {
      process.env.NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE = prevFlag;
      process.env.ENABLE_SOUQ_FISHING_MODULE = prevFlag2;
    }
  });
});
