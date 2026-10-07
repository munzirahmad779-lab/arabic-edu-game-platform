import { test, expect } from "@playwright/test";

test.describe("08. Results, Scoring & Leaderboard Consistency Gate", () => {
  test("Calculates correct ranking order with score priority and response time tiebreaker", async () => {
    interface ParticipantRecord {
      id: string;
      name: string;
      score: number;
      avgResponseMs: number;
    }

    const participants: ParticipantRecord[] = [
      { id: "p1", name: "Ahmad", score: 300, avgResponseMs: 4000 },
      { id: "p2", name: "Budi", score: 400, avgResponseMs: 5000 },
      { id: "p3", name: "Chandra", score: 300, avgResponseMs: 3200 }, // Tied score with Ahmad, but faster
    ];

    const ranked = [...participants].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.avgResponseMs - b.avgResponseMs;
    });

    expect(ranked[0].name).toBe("Budi");
    expect(ranked[1].name).toBe("Chandra"); // Faster than Ahmad
    expect(ranked[2].name).toBe("Ahmad");
  });

  test("Accuracy percentage calculates accurately without divide-by-zero errors", async () => {
    function calculateAccuracy(correct: number, total: number): number {
      if (total === 0) return 0;
      return Math.round((correct / total) * 100);
    }

    expect(calculateAccuracy(0, 0)).toBe(0);
    expect(calculateAccuracy(4, 5)).toBe(80);
    expect(calculateAccuracy(3, 3)).toBe(100);
    expect(calculateAccuracy(0, 5)).toBe(0);
  });
});
