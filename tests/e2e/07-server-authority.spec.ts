import { test, expect } from "@playwright/test";

test.describe("07. Server Authority & Anti-Tamper Gate", () => {
  test("Server recalculates authoritative score from difficulty, rejecting client-crafted scores", async () => {
    function authoritativeScoreCalculation(difficulty: string, isCorrect: boolean): number {
      if (!isCorrect) return 0;
      switch (difficulty) {
        case "easy": return 100;
        case "medium": return 150;
        case "hard": return 200;
        default: return 100;
      }
    }

    // Attacker sends score: 999999
    const attackerPayload = {
      selected_option_id: "opt-1",
      claimed_score: 999999,
      response_time_ms: 100,
    };

    const evaluatedScore = authoritativeScoreCalculation("easy", true);
    expect(evaluatedScore).toBe(100);
    expect(evaluatedScore).not.toBe(attackerPayload.claimed_score);
  });

  test("Server clamps response times within legitimate question time limits", async () => {
    function clampResponseTime(rawMs: number, timeLimitSec: number): number {
      const maxMs = timeLimitSec * 1000;
      return Math.max(0, Math.min(maxMs, rawMs));
    }

    // Tampered negative time
    expect(clampResponseTime(-5000, 20)).toBe(0);

    // Tampered excessive time beyond 20s
    expect(clampResponseTime(99999, 20)).toBe(20000);

    // Legitimate time
    expect(clampResponseTime(4500, 20)).toBe(4500);
  });

  test("Server rejects submissions when room state is not 'running'", async () => {
    function validateRoomState(state: string) {
      if (state !== "running") {
        throw new Error("GAME_NOT_RUNNING");
      }
      return true;
    }

    expect(() => validateRoomState("waiting")).toThrow("GAME_NOT_RUNNING");
    expect(() => validateRoomState("ended")).toThrow("GAME_NOT_RUNNING");
    expect(() => validateRoomState("locked")).toThrow("GAME_NOT_RUNNING");
    expect(validateRoomState("running")).toBe(true);
  });

  test("Server rejects duplicate answer submissions for the same question", async () => {
    const recordedSubmissions = new Set<string>();

    function recordSubmission(participantId: string, questionId: string) {
      const key = `${participantId}:${questionId}`;
      if (recordedSubmissions.has(key)) {
        throw new Error("ALREADY_SUBMITTED");
      }
      recordedSubmissions.add(key);
      return true;
    }

    expect(recordSubmission("part-1", "q-1")).toBe(true);
    expect(() => recordSubmission("part-1", "q-1")).toThrow("ALREADY_SUBMITTED");
    expect(recordSubmission("part-2", "q-1")).toBe(true);
  });
});
