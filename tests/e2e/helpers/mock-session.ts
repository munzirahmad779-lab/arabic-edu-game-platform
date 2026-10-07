import type { GameSessionContext, RawQuestion } from "@/lib/game-engine/types";

export function createMockSession(overrides: Partial<GameSessionContext> = {}): GameSessionContext {
  return {
    roomId: "11111111-1111-1111-1111-111111111111",
    roomCode: "TEST88",
    gameName: "Permainan Uji E2E",
    gameType: "runner",
    gameMode: "competitive",
    durationSeconds: 300,
    participantId: "22222222-2222-2222-2222-222222222222",
    participantName: "Siswa Uji",
    questionIndex: 0,
    questionCount: 3,
    isRtl: false,
    ...overrides,
  };
}

export function createMockQuestions(): RawQuestion[] {
  return [
    {
      id: "q-1",
      question_text: "كِتَابٌ : Buku",
      difficulty: "easy",
      correct_option_key: "A",
      options: [
        { id: "opt-1", option_key: "A", option_text: "Buku" },
        { id: "opt-2", option_key: "B", option_text: "Pena" },
        { id: "opt-3", option_key: "C", option_text: "Meja" },
        { id: "opt-4", option_key: "D", option_text: "Kursi" },
      ],
    },
    {
      id: "q-2",
      question_text: "قَلَمٌ : Pena",
      difficulty: "medium",
      correct_option_key: "B",
      options: [
        { id: "opt-5", option_key: "A", option_text: "Kertas" },
        { id: "opt-6", option_key: "B", option_text: "Pena" },
        { id: "opt-7", option_key: "C", option_text: "Papan" },
        { id: "opt-8", option_key: "D", option_text: "Tas" },
      ],
    },
  ];
}
