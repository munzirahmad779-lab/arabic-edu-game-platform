/**
 * Durasi per soal: satu-satunya definisi bersama sisi TypeScript.
 *
 * Cermin dari sisi database:
 * - public.game_time_limit_for_difficulty (migrasi 0029):
 *   easy = 20 dtk, medium = 30 dtk, hard = 45 dtk.
 * - public.game_effective_time_limit_seconds (migrasi 0074):
 *   durasi efektif = max(override room ?? limit difficulty, 30).
 *
 * Keputusan user 29 Okt 2026: waktu per soal MINIMAL 30 detik dan dapat
 * diatur guru dari ruang guru (rooms.question_duration_seconds, NULL =
 * ikut difficulty dengan lantai 30).
 */

export const MIN_QUESTION_DURATION_SECONDS = 30;

/** Pilihan durasi yang ditawarkan ke guru di ruang guru (detik). */
export const QUESTION_DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;

/** Cermin public.game_time_limit_for_difficulty (migrasi 0029). */
export function timeLimitForDifficulty(difficulty: string | null | undefined): number {
  switch ((difficulty ?? "easy").toLowerCase()) {
    case "medium":
      return 30;
    case "hard":
      return 45;
    case "easy":
    default:
      return 20;
  }
}

/**
 * Cermin public.game_effective_time_limit_seconds (migrasi 0074).
 * Override room (bila guru mengaturnya) menang atas difficulty, dan hasil
 * akhir tidak pernah di bawah lantai 30 detik.
 */
export function resolveEffectiveQuestionDurationSeconds(
  difficulty: string | null | undefined,
  roomOverrideSeconds: number | null | undefined,
): number {
  const base =
    typeof roomOverrideSeconds === "number" && roomOverrideSeconds > 0
      ? roomOverrideSeconds
      : timeLimitForDifficulty(difficulty);
  return Math.max(base, MIN_QUESTION_DURATION_SECONDS);
}
