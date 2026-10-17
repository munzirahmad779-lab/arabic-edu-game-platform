import type {
  FinalTeamResult,
  IndividualSubmissionPayload,
  ResultSinkAdapter,
} from "./types";

/**
 * MagguruResultSinkAdapter stub.
 * Writes projector team rankings to `/api/projector/save-report` and
 * individual student answers to Magguru's `submit_game_answer` RPC.
 */
export class MagguruResultSinkAdapter implements ResultSinkAdapter {
  async submitProjectorReport(
    _roomId: string,
    _roomCode: string,
    results: FinalTeamResult[],
  ): Promise<{ success: boolean; error?: string }> {
    if (!results || results.length === 0) {
      return { success: false, error: "NO_RESULTS_PROVIDED" };
    }
    // Stub implementation for Phase 1
    return { success: true };
  }

  async submitStudentAnswer(
    submission: IndividualSubmissionPayload,
  ): Promise<{ accepted: boolean; isCorrect: boolean; scoreAwarded: number }> {
    if (!submission.joinToken || !submission.questionId) {
      return { accepted: false, isCorrect: false, scoreAwarded: 0 };
    }
    // Stub implementation for Phase 1
    return { accepted: true, isCorrect: true, scoreAwarded: 100 };
  }
}
