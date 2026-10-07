import { test, expect } from "@playwright/test";
import { GameRegistry } from "@/lib/game-engine/registry";

test.describe("04. Game Creation & Mode Capability Gate", () => {
  test("GameRegistry registers all 5 canonical game engines with proper capabilities", async () => {
    const registeredTypes = GameRegistry.getAll();
    const typeIds = registeredTypes.map((t) => t.id);

    expect(typeIds).toContain("runner");
    expect(typeIds).toContain("matching");
    expect(typeIds).toContain("penalty");
    expect(typeIds).toContain("anagram");
    expect(typeIds).toContain("quiz");

    // Verify Runner capabilities
    const runner = GameRegistry.get("runner");
    expect(runner.capabilities.supportedModes).toContain("competitive");
    expect(runner.capabilities.supportedModes).not.toContain("cooperative");

    // Verify Penalty capabilities
    const penalty = GameRegistry.get("penalty");
    expect(penalty.capabilities.supportedModes).toContain("competitive");
    expect(penalty.capabilities.supportedModes).not.toContain("cooperative");
    expect(penalty.capabilities.supportedModes).not.toContain("endless");

    // Verify Quiz capabilities (supports full matrix)
    const quiz = GameRegistry.get("quiz");
    expect(quiz.capabilities.supportedModes).toContain("competitive");
    expect(quiz.capabilities.supportedModes).toContain("cooperative");
    expect(quiz.capabilities.supportedModes).toContain("endless");
  });

  test("Legacy resolution guarantees Case A, B, C mapping without side effects", async () => {
    // Legacy Case A
    expect(GameRegistry.resolve("arabic_chase_race", "anagram")).toBe("anagram");
    // Legacy Case B
    expect(GameRegistry.resolve("arabic_chase_race", "matching")).toBe("matching");
    // Legacy Case C
    expect(GameRegistry.resolve("arabic_chase_race", "competitive")).toBe("runner");

    // Modern resolution
    expect(GameRegistry.resolve("runner", "competitive")).toBe("runner");
    expect(GameRegistry.resolve("matching", "practice")).toBe("matching");
    expect(GameRegistry.resolve("penalty", "competitive")).toBe("penalty");
  });
});
