/**
 * Seeded RNG Provider & Deck Shuffle Utilities.
 * Pure Fisher-Yates algorithms — no direct Math.random() calls.
 */

export interface RngProvider {
  /**
   * Returns a pseudo-random floating point number in [0, 1).
   */
  nextFloat(): number;
}

/**
 * Deterministic test mock RNG cycling through a sequence of floats.
 */
export class SequenceRng implements RngProvider {
  private index = 0;
  constructor(private readonly sequence: readonly number[] = [0.1, 0.5, 0.9]) {}

  nextFloat(): number {
    if (this.sequence.length === 0) return 0;
    const val = this.sequence[this.index % this.sequence.length];
    this.index++;
    return val;
  }
}

/**
 * Pure Fisher-Yates shuffle using an injected RngProvider.
 * Does NOT mutate the input array.
 */
export function shuffleSeeded<T>(arr: readonly T[], rng: RngProvider): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.nextFloat() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Prioritizes questions that students previously answered incorrectly,
 * lifting them into the first 40% of the shuffled question deck.
 */
export function prioritizeWrongQuestions<T extends { id: string }>(
  deck: readonly T[],
  wrongQuestionIds: ReadonlySet<string> | readonly string[],
  rng: RngProvider
): T[] {
  if (deck.length === 0) return [];
  const wrongSet =
    wrongQuestionIds instanceof Set
      ? wrongQuestionIds
      : new Set(wrongQuestionIds);

  const wrongPool: T[] = [];
  const standardPool: T[] = [];

  for (const item of deck) {
    if (wrongSet.has(item.id)) {
      wrongPool.push(item);
    } else {
      standardPool.push(item);
    }
  }

  const shuffledWrong = shuffleSeeded(wrongPool, rng);
  const shuffledStandard = shuffleSeeded(standardPool, rng);

  // Target count for wrong questions to place in the front (up to 40% of total deck)
  const targetFrontCapacity = Math.max(1, Math.floor(deck.length * 0.4));
  const frontWrong = shuffledWrong.slice(0, targetFrontCapacity);
  const remainingWrong = shuffledWrong.slice(targetFrontCapacity);

  const combinedRemaining = shuffleSeeded(
    [...remainingWrong, ...shuffledStandard],
    rng
  );

  return [...frontWrong, ...combinedRemaining];
}
