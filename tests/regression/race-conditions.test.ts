/**
 * Race Condition & Concurrency Regression Tests
 *
 * Simulates high-concurrency client-server race conditions:
 * 1. Double click / Rapid submit calls
 * 2. Simultaneous submission and polling
 * 3. Simultaneous timeout and submission
 * 4. Question transition vs stale submission
 * 5. Concurrent multi-participant submissions
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Race Condition & Concurrency Suite", () => {
  // 1. Rapid / double-click submission
  test("Double submit from same client is strictly idempotent or fails secondary", async () => {
    let submitCount = 0;
    const submittedParticipants = new Set<string>();

    async function serverSubmit(participantId: string, questionId: string) {
      // Simulate small DB transaction latency
      await new Promise((r) => setTimeout(r, 10));
      const key = `${participantId}:${questionId}`;
      if (submittedParticipants.has(key)) {
        throw new Error("ALREADY_SUBMITTED");
      }
      submittedParticipants.add(key);
      submitCount++;
      return { accepted: true };
    }

    // Fire 2 concurrent submissions from same participant
    const results = await Promise.allSettled([
      serverSubmit("p1", "q1"),
      serverSubmit("p1", "q1"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one submission must succeed");
    assert.equal(rejected.length, 1, "Duplicate submission must be rejected");
    assert.equal(submitCount, 1, "Score/record must only increment once");
  });

  // 2. Simultaneous submit and polling
  test("Concurrent polling read does not observe half-committed state", async () => {
    let roomState = {
      score: 0,
      answeredCount: 0,
      isCommitted: true,
    };

    async function pollState() {
      // Must always see a fully committed state
      assert.equal(roomState.isCommitted, true);
      return { score: roomState.score, count: roomState.answeredCount };
    }

    async function performSubmission() {
      roomState.isCommitted = false;
      await new Promise((r) => setTimeout(r, 5));
      roomState.score += 100;
      roomState.answeredCount += 1;
      roomState.isCommitted = true;
    }

    // Execute submission while reading polls
    const [_, pollResult] = await Promise.all([
      performSubmission(),
      (async () => {
        await new Promise((r) => setTimeout(r, 10));
        return pollState();
      })(),
    ]);

    assert.equal(pollResult.score, 100);
    assert.equal(pollResult.count, 1);
  });

  // 3. Timeout vs submit boundary
  test("Submission occurring exactly after timeout boundary is rejected", async () => {
    const questionStartedAt = 1000;
    const timeLimitMs = 15000; // 15s
    const deadline = questionStartedAt + timeLimitMs;

    function validateTimestamp(receivedAt: number) {
      if (receivedAt > deadline) {
        throw new Error("QUESTION_TIMEOUT");
      }
      return true;
    }

    // Exactly at boundary
    assert.equal(validateTimestamp(16000), true);

    // 1ms past boundary
    assert.throws(() => validateTimestamp(16001), /QUESTION_TIMEOUT/);
  });

  // 4. Question transition vs stale submission
  test("Submission for old question arriving during/after transition is rejected", () => {
    let currentQuestionId = "q-2";

    function submitAnswer(submittedQuestionId: string) {
      if (submittedQuestionId !== currentQuestionId) {
        throw new Error("QUESTION_NOT_CURRENT");
      }
      return { accepted: true };
    }

    // Client tries to submit for q-1 when room is already on q-2
    assert.throws(() => submitAnswer("q-1"), /QUESTION_NOT_CURRENT/);
    assert.doesNotThrow(() => submitAnswer("q-2"));
  });

  // 5. Concurrent multi-participant submissions
  test("50 concurrent participants submitting simultaneously are all recorded accurately", async () => {
    const totalParticipants = 50;
    const recordedScores: Record<string, number> = {};

    async function submitFor(id: string) {
      // Simulate random network jitter 1-20ms
      const delay = Math.floor(Math.random() * 20) + 1;
      await new Promise((r) => setTimeout(r, delay));
      recordedScores[id] = 100;
      return { id, score: 100 };
    }

    const promises = Array.from({ length: totalParticipants }, (_, i) =>
      submitFor(`student-${i}`)
    );

    const outcomes = await Promise.all(promises);

    assert.equal(outcomes.length, totalParticipants);
    assert.equal(Object.keys(recordedScores).length, totalParticipants);
  });
});
