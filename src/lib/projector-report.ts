/**
 * Susunan payload laporan hasil permainan proyektor untuk
 * POST /api/projector/save-report.
 *
 * Fungsi murni (tanpa akses jaringan/DOM) agar bisa diuji unit:
 * - Tim diurutkan dari skor tertinggi, peringkat 1-based mengikuti urutan itu.
 * - classId hanya disertakan bila kelas sungguhan (bukan kelas semu
 *   "room-online" untuk peserta room daring, bukan string kosong).
 * - gameId hanya disertakan bila ada dan bukan id uji ("test-...").
 */

export interface ProjectorReportTeamInput {
  id: string;
  name: string;
  score: number;
  correctCount: number;
  members?: Array<{ id: string; name: string }>;
}

export interface ProjectorReportTeamPayload {
  id: string;
  name: string;
  score: number;
  correctCount: number;
  rank: number;
  members: Array<{ id: string; name: string }>;
}

export interface ProjectorReportPayload {
  gameId?: string;
  gameName: string;
  classId?: string;
  roomCode: string;
  targetRounds: number;
  teams: ProjectorReportTeamPayload[];
}

export function buildProjectorReportPayload(input: {
  gameId?: string;
  gameName: string;
  classId?: string;
  roomCode: string;
  totalQuestions: number;
  teams: ProjectorReportTeamInput[];
}): ProjectorReportPayload {
  const sorted = [...input.teams].sort((a, b) => b.score - a.score);

  const payload: ProjectorReportPayload = {
    gameName: input.gameName,
    roomCode: input.roomCode,
    targetRounds: Math.max(1, input.totalQuestions),
    teams: sorted.map((t, idx) => ({
      id: t.id,
      name: t.name,
      score: t.score,
      correctCount: t.correctCount,
      rank: idx + 1,
      members: (t.members ?? []).map((m) => ({ id: m.id, name: m.name })),
    })),
  };

  if (input.gameId && !input.gameId.startsWith("test-")) {
    payload.gameId = input.gameId;
  }

  if (input.classId && input.classId !== "room-online") {
    payload.classId = input.classId;
  }

  return payload;
}
