import type {
  AuthoritativeQuestion,
  QuestionSourceAdapter,
  SanitizedQuestion,
} from "./types";

/**
 * Sanitizes a question for client transport, stripping out the correct answer keys.
 * Preserves sacred Arabic harakat and Lontara scripts intact.
 */
export function sanitizeQuestionForClient(q: AuthoritativeQuestion): SanitizedQuestion {
  return {
    id: q.id,
    position: q.position,
    questionText: q.questionText,
    difficulty: q.difficulty,
    timeLimitSeconds: q.timeLimitSeconds,
    options: q.options.map((opt) => ({
      id: opt.id,
      optionKey: opt.optionKey,
      optionText: opt.optionText,
    })),
    media: q.media,
  };
}

/**
 * QuestionSourceAdapter implementation stub.
 * Connects with Magguru room snapshots and question banks.
 */
export class MagguruQuestionSourceAdapter implements QuestionSourceAdapter {
  private inMemoryCache: Map<string, AuthoritativeQuestion[]> = new Map();

  constructor(initialQuestions?: Record<string, AuthoritativeQuestion[]>) {
    if (initialQuestions) {
      for (const [roomId, questions] of Object.entries(initialQuestions)) {
        this.inMemoryCache.set(roomId, questions);
      }
    }
  }

  async getQuestions(roomId: string): Promise<AuthoritativeQuestion[]> {
    return this.inMemoryCache.get(roomId) ?? [];
  }

  async getSanitizedQuestion(
    roomId: string,
    questionIndex: number,
  ): Promise<SanitizedQuestion | null> {
    const list = await this.getQuestions(roomId);
    const raw = list[questionIndex];
    if (!raw) return null;
    return sanitizeQuestionForClient(raw);
  }

  async verifyAnswer(
    questionId: string,
    submittedOptionIdOrKey: string,
  ): Promise<{ isCorrect: boolean; correctOptionKey: string; scoreAwarded: number }> {
    for (const list of this.inMemoryCache.values()) {
      const match = list.find((q) => q.id === questionId);
      if (match) {
        const isMatch =
          match.correctOptionKey.toUpperCase() === submittedOptionIdOrKey.toUpperCase() ||
          match.options.some(
            (o) => o.id === submittedOptionIdOrKey && o.optionKey === match.correctOptionKey,
          );
        const weight = match.difficulty === "hard" ? 150 : match.difficulty === "medium" ? 100 : 50;
        return {
          isCorrect: isMatch,
          correctOptionKey: match.correctOptionKey,
          scoreAwarded: isMatch ? weight : 0,
        };
      }
    }
    return { isCorrect: false, correctOptionKey: "", scoreAwarded: 0 };
  }
}
