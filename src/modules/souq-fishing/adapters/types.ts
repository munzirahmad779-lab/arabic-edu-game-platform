/**
 * Adapter Contracts for Souq & Fishing Game Module.
 * Strict TypeScript interfaces decoupling the pure game engine from Magguru web infrastructure.
 * Zero `any` or `@ts-ignore`.
 */

export interface QuestionOption {
  id: string;
  optionKey: string;
  optionText: string;
}

/**
 * Question format sent to the client (HP controller or student view).
 * STRICT PRIVACY: `correctOptionId`, `correctOptionKey`, and `isCorrect` MUST NEVER exist here.
 */
export interface SanitizedQuestion {
  id: string;
  position: number;
  questionText: string;
  difficulty: "easy" | "medium" | "hard" | string;
  timeLimitSeconds?: number;
  options: QuestionOption[];
  media?: Array<{
    id: string;
    mediaType: string;
    publicUrl: string;
  }>;
}

/**
 * Raw question retrieved securely on the server / host authoritative side.
 */
export interface AuthoritativeQuestion extends SanitizedQuestion {
  correctOptionKey: string;
  explanation?: string;
}

/**
 * 1. QuestionSourceAdapter:
 * Reads questions from Magguru room snapshots or bank, preserving sacred Arabic harakat and Lontara glyphs.
 */
export interface QuestionSourceAdapter {
  getQuestions(roomId: string): Promise<AuthoritativeQuestion[]>;
  getSanitizedQuestion(roomId: string, questionIndex: number): Promise<SanitizedQuestion | null>;
  verifyAnswer(
    questionId: string,
    submittedOptionIdOrKey: string,
  ): Promise<{ isCorrect: boolean; correctOptionKey: string; scoreAwarded: number }>;
}

export type TransportRole = "host" | "controller" | "student" | "spectator";

export interface TransportMessage<T = unknown> {
  id: string;
  roomCode: string;
  senderRole: TransportRole;
  senderId: string;
  action: string;
  payload: T;
  timestamp: number;
}

/**
 * 2. TransportAdapter:
 * Real-time event communication between Host Projector, Mobile Controllers, and Students.
 * Backed by HTTP polling + Supabase Realtime Broadcast.
 */
export interface TransportAdapter {
  connect(roomCode: string, role: TransportRole, clientId: string): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage<T>(action: string, payload: T): Promise<boolean>;
  onMessage<T>(action: string, callback: (msg: TransportMessage<T>) => void): () => void;
  getActiveControllers(): Promise<string[]>;
}

export interface CheckpointData {
  version: number;
  roomCode: string;
  phase: "lobby" | "traveling" | "challenge" | "fishing" | "fish_caught" | "finished";
  activeNodeId: string;
  currentQuestionIndex: number;
  virtualTimeElapsedMs: number;
  teamsState: Record<
    string,
    {
      score: number;
      correctCount: number;
      inventory: string[];
      characterId: string;
      currentNodeId: string;
    }
  >;
  rngSeed: number;
  updatedAt: string;
}

/**
 * 3. CheckpointStoreAdapter:
 * Server-authoritative checkpoint persistence with 64 KB size guard and atomic merge.
 */
export interface CheckpointStoreAdapter {
  saveCheckpoint(roomCode: string, checkpoint: CheckpointData): Promise<boolean>;
  loadCheckpoint(roomCode: string): Promise<CheckpointData | null>;
  clearCheckpoint(roomCode: string): Promise<boolean>;
}

export interface FinalTeamResult {
  teamId: string;
  teamName: string;
  characterId: string;
  finalScore: number;
  correctAnswersCount: number;
  rank: number;
  fishesCaught: number;
  members?: Array<{ id: string; name: string }>;
}

export interface IndividualSubmissionPayload {
  joinToken: string;
  questionId: string;
  selectedOptionId?: string;
  selectedOptionKey?: string;
  responseTimeMs: number;
}

/**
 * 4. ResultSinkAdapter:
 * Persists match results and student grades back into Magguru reporting infrastructure.
 */
export interface ResultSinkAdapter {
  submitProjectorReport(
    roomId: string,
    roomCode: string,
    results: FinalTeamResult[],
  ): Promise<{ success: boolean; error?: string }>;

  submitStudentAnswer(
    submission: IndividualSubmissionPayload,
  ): Promise<{ accepted: boolean; isCorrect: boolean; scoreAwarded: number }>;
}
