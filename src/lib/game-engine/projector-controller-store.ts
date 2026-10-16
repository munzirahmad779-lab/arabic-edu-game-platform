export interface ControllerEvent {
  id: string;
  roomCode: string;
  teamId: string;
  playerName: string;
  optionId?: string | null;
  optionKey?: string | null;
  action?: "press" | "heartbeat";
  timestamp: number;
}

export interface ProjectorGameState {
  phase: "lobby" | "question" | "reveal" | "leaderboard" | "finished";
  currentQuestionIndex: number;
  timerSeconds: number;
  totalQuestions: number;
  questionText?: string;
  answeredTeams: Record<string, { optionKey: string; timestamp: number }>;
  lastUpdated: number;
}

export interface RoomControllerData {
  events: ControllerEvent[];
  heartbeats: Record<string, number>;
  gameState: ProjectorGameState;
}

// Global in-memory storage for active hotseat projector controller sessions
declare global {
  // eslint-disable-next-line no-var
  var __projectorControllerStore: Map<string, RoomControllerData> | undefined;
}

const store =
  globalThis.__projectorControllerStore ??
  new Map<string, RoomControllerData>();
globalThis.__projectorControllerStore = store;

export function getProjectorRoomData(roomCode: string): RoomControllerData {
  const normalized = roomCode.toUpperCase().trim();
  let data = store.get(normalized);
  if (!data) {
    data = {
      events: [],
      heartbeats: {},
      gameState: {
        phase: "lobby",
        currentQuestionIndex: 0,
        timerSeconds: 20,
        totalQuestions: 1,
        answeredTeams: {},
        lastUpdated: Date.now(),
      },
    };
    store.set(normalized, data);
  }
  return data;
}

export function isProjectorRoomActive(roomCode: string): boolean {
  const normalized = roomCode.toUpperCase().trim();
  return store.has(normalized);
}
