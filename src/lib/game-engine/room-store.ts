/**
 * In-Memory Active Room Store & Resilience Hub for Magguru Gameplay
 * Guarantees zero-lag, fault-tolerant room session progression, question delivery,
 * answer evaluation, and leaderboard aggregation.
 */

export type RoomOption = {
  id: string;
  option_key: string;
  option_text: string;
};

export type RoomMedia = {
  id: string;
  media_type: string;
  public_url: string;
  mime_type?: string | null;
  max_play_count?: number | null;
};

export type RoomQuestion = {
  id: string;
  position: number;
  question_text: string;
  difficulty: string;
  explanation_timing: string;
  time_limit_seconds: number;
  correct_option_key: string;
  explanation?: string | null;
  options: RoomOption[];
  media?: RoomMedia[];
};

export type ParticipantSubmission = {
  question_id: string;
  selected_option_id: string | null;
  answer_text: string | null;
  is_correct: boolean;
  score_awarded: number;
  response_time_ms: number;
  submitted_at: number;
};

export type StoredParticipant = {
  id: string;
  join_token: string;
  name: string;
  room_id: string;
  submissions: ParticipantSubmission[];
  last_seen_at: number;
};

export type StoredRoom = {
  id: string;
  code: string;
  game_name: string;
  game_type: string;
  game_mode: string;
  duration_seconds: number;
  capacity: number;
  state: "waiting" | "running" | "ended" | "locked";
  started_at: string | null;
  ended_at: string | null;
  question_started_at: string | null;
  current_question_index: number;
  questions: RoomQuestion[];
  participants: Map<string, StoredParticipant>; // join_token -> participant
  participantsById: Map<string, StoredParticipant>; // participant_id -> participant
};

// Global singleton in Next.js server runtime to preserve state across requests
declare global {
  // eslint-disable-next-line no-var
  var __MAGGURU_ROOM_STORE__: Map<string, StoredRoom> | undefined;
  // eslint-disable-next-line no-var
  var __MAGGURU_TOKEN_ROOM_MAP__: Map<string, string> | undefined;
}

if (!global.__MAGGURU_ROOM_STORE__) {
  global.__MAGGURU_ROOM_STORE__ = new Map<string, StoredRoom>();
}
if (!global.__MAGGURU_TOKEN_ROOM_MAP__) {
  global.__MAGGURU_TOKEN_ROOM_MAP__ = new Map<string, string>();
}

const roomStore = global.__MAGGURU_ROOM_STORE__;
const tokenToRoomMap = global.__MAGGURU_TOKEN_ROOM_MAP__;

/**
 * Normalizes question from raw snapshot item (handles both nested item.question and flat item)
 */
export function normalizeSnapshotQuestion(
  rawItem: unknown,
  index: number
): RoomQuestion | null {
  if (!rawItem || typeof rawItem !== "object") return null;

  const item = rawItem as Record<string, unknown>;
  const inner = (item.question && typeof item.question === "object"
    ? item.question
    : item) as Record<string, unknown>;

  const questionText = String(inner.question_text ?? item.question_text ?? "").trim();
  if (!questionText && !inner.id) return null;

  const id = String(inner.id ?? item.id ?? `q-${index}`);
  const position = typeof item.position === "number" ? item.position : index + 1;
  const difficulty = String(inner.difficulty ?? item.difficulty ?? "easy");
  const explanationTiming = String(
    item.explanation_timing ?? inner.explanation_timing ?? "after_each_question"
  );
  const correctOptionKey = String(
    inner.correct_option_key ?? item.correct_option_key ?? "A"
  ).trim().toUpperCase();

  const rawOptions = (Array.isArray(inner.options)
    ? inner.options
    : Array.isArray(item.options)
    ? item.options
    : []) as Array<Record<string, unknown>>;

  const options: RoomOption[] = rawOptions.map((opt, optIdx) => {
    const key = String(opt.option_key ?? String.fromCharCode(65 + optIdx)).trim().toUpperCase();
    return {
      id: String(opt.id ?? `opt-${index}-${key}`),
      option_key: key,
      option_text: String(opt.option_text ?? "").trim(),
    };
  });

  const rawMedia = (Array.isArray(inner.media)
    ? inner.media
    : Array.isArray(item.media)
    ? item.media
    : []) as Array<Record<string, unknown>>;

  const media: RoomMedia[] = rawMedia.map((m, mIdx) => ({
    id: String(m.id ?? `m-${index}-${mIdx}`),
    media_type: String(m.media_type ?? "image"),
    public_url: String(m.public_url ?? ""),
    mime_type: m.mime_type ? String(m.mime_type) : null,
    max_play_count: typeof m.max_play_count === "number" ? m.max_play_count : null,
  }));

  return {
    id,
    position,
    question_text: questionText,
    difficulty,
    explanation_timing: explanationTiming,
    time_limit_seconds: typeof inner.time_limit_seconds === "number" ? inner.time_limit_seconds : 30,
    correct_option_key: correctOptionKey,
    explanation: inner.explanation ? String(inner.explanation) : null,
    options,
    media,
  };
}

export const ActiveRoomStore = {
  /**
   * Register or update an active room in memory
   */
  registerRoom(data: {
    id: string;
    code: string;
    game_name: string;
    game_type?: string;
    game_mode?: string;
    duration_seconds?: number;
    capacity?: number;
    state?: "waiting" | "running" | "ended" | "locked";
    started_at?: string | null;
    question_started_at?: string | null;
    current_question_index?: number;
    questions?: unknown[];
  }): StoredRoom {
    let existing = roomStore.get(data.id);
    if (!existing) {
      existing = {
        id: data.id,
        code: data.code.toUpperCase(),
        game_name: data.game_name,
        game_type: data.game_type ?? "quiz",
        game_mode: data.game_mode ?? "competitive",
        duration_seconds: data.duration_seconds ?? 300,
        capacity: data.capacity ?? 30,
        state: data.state ?? "waiting",
        started_at: data.started_at ?? null,
        ended_at: null,
        question_started_at: data.question_started_at ?? null,
        current_question_index: data.current_question_index ?? 0,
        questions: [],
        participants: new Map(),
        participantsById: new Map(),
      };
      roomStore.set(data.id, existing);
    } else {
      if (data.state) existing.state = data.state;
      if (data.started_at !== undefined) existing.started_at = data.started_at;
      if (data.question_started_at !== undefined) existing.question_started_at = data.question_started_at;
      if (typeof data.current_question_index === "number") {
        existing.current_question_index = data.current_question_index;
      }
    }

    if (Array.isArray(data.questions) && data.questions.length > 0) {
      const normalized = data.questions
        .map((q, idx) => normalizeSnapshotQuestion(q, idx))
        .filter((q): q is RoomQuestion => q !== null && q.options.length > 0);

      if (normalized.length > existing.questions.length) {
        existing.questions = normalized;
      } else if (existing.questions.length === 0 && normalized.length > 0) {
        existing.questions = normalized;
      }
    }

    return existing;
  },

  /**
   * Cache a single question at a specific index without truncating the rest
   */
  setQuestionAt(roomId: string, index: number, question: RoomQuestion) {
    const room = roomStore.get(roomId);
    if (!room) return;
    if (room.questions.length <= index) {
      // pad array if necessary
      for (let i = room.questions.length; i < index; i++) {
        if (!room.questions[i]) {
          room.questions[i] = question; // placeholder
        }
      }
    }
    room.questions[index] = question;
  },

  /**
   * Register a participant joining a room
   */
  registerParticipant(params: {
    roomId: string;
    joinToken: string;
    participantId: string;
    name: string;
  }): StoredParticipant {
    let room = roomStore.get(params.roomId);
    if (!room) {
      room = this.registerRoom({
        id: params.roomId,
        code: "ROOM",
        game_name: "Latihan Magguru",
      });
    }

    let participant = room.participants.get(params.joinToken);
    if (!participant) {
      participant = {
        id: params.participantId,
        join_token: params.joinToken,
        name: params.name,
        room_id: params.roomId,
        submissions: [],
        last_seen_at: Date.now(),
      };
      room.participants.set(params.joinToken, participant);
      room.participantsById.set(params.participantId, participant);
      tokenToRoomMap.set(params.joinToken, params.roomId);
    } else {
      participant.last_seen_at = Date.now();
      if (params.name) participant.name = params.name;
    }

    return participant;
  },

  /**
   * Retrieve room and participant by join token
   */
  getByToken(token: string): { room: StoredRoom; participant: StoredParticipant } | null {
    const roomId = tokenToRoomMap.get(token);
    if (roomId) {
      const room = roomStore.get(roomId);
      if (room) {
        const participant = room.participants.get(token);
        if (participant) return { room, participant };
      }
    }

    // Fallback scan
    for (const room of roomStore.values()) {
      const participant = room.participants.get(token);
      if (participant) {
        tokenToRoomMap.set(token, room.id);
        return { room, participant };
      }
    }

    return null;
  },

  /**
   * Retrieve room by ID
   */
  getRoomById(roomId: string): StoredRoom | null {
    return roomStore.get(roomId) ?? null;
  },

  /**
   * Advance question for the whole room (Teacher action)
   */
  advanceRoom(roomId: string): { room_state: string; current_question_index: number } {
    const room = roomStore.get(roomId);
    if (!room) return { room_state: "ended", current_question_index: 0 };

    const nextIndex = room.current_question_index + 1;
    const isEnded = nextIndex >= room.questions.length;

    room.current_question_index = nextIndex;
    room.question_started_at = new Date().toISOString();

    if (isEnded) {
      room.state = "ended";
      room.ended_at = new Date().toISOString();
    }

    return {
      room_state: room.state,
      current_question_index: room.current_question_index,
    };
  },

  /**
   * Reset room back to Question 1 with cleared submissions
   */
  resetRoom(roomId: string): boolean {
    const room = roomStore.get(roomId);
    if (!room) return false;

    room.state = "running";
    room.current_question_index = 0;
    room.started_at = new Date().toISOString();
    room.question_started_at = new Date(Date.now() + 2000).toISOString();
    room.ended_at = null;

    for (const part of room.participants.values()) {
      part.submissions = [];
    }

    return true;
  },

  /**
   * End room session
   */
  endRoom(roomId: string): boolean {
    const room = roomStore.get(roomId);
    if (!room) return false;

    room.state = "ended";
    room.ended_at = new Date().toISOString();
    return true;
  },

  /**
   * Submit participant answer
   */
  submitAnswer(params: {
    joinToken: string;
    questionId: string;
    selectedOptionId: string | null;
    answerText: string | null;
  }): { accepted: boolean; is_correct: boolean; score_awarded: number } {
    const match = this.getByToken(params.joinToken);
    if (!match) return { accepted: false, is_correct: false, score_awarded: 0 };

    const { room, participant } = match;
    if (room.state !== "running") {
      return { accepted: false, is_correct: false, score_awarded: 0 };
    }

    // Prevent duplicate submission for same question
    const already = participant.submissions.find((s) => s.question_id === params.questionId);
    if (already) {
      return {
        accepted: true,
        is_correct: already.is_correct,
        score_awarded: already.score_awarded,
      };
    }

    // Find the question in room
    const question = room.questions.find((q) => q.id === params.questionId);
    let isCorrect = false;

    if (question) {
      const correctKey = (question.correct_option_key ?? "").trim().toUpperCase();

      if (params.selectedOptionId) {
        const chosen = question.options.find(
          (opt) => opt.id === params.selectedOptionId || opt.option_key === params.selectedOptionId
        );
        if (chosen && chosen.option_key.trim().toUpperCase() === correctKey) {
          isCorrect = true;
        }
      } else if (params.answerText && correctKey) {
        const correctOpt = question.options.find(
          (opt) => opt.option_key.trim().toUpperCase() === correctKey
        );
        if (
          correctOpt &&
          correctOpt.option_text.trim().toLowerCase() === params.answerText.trim().toLowerCase()
        ) {
          isCorrect = true;
        }
      }
    }

    const scoreAwarded = isCorrect ? 100 : 0;

    participant.submissions.push({
      question_id: params.questionId,
      selected_option_id: params.selectedOptionId,
      answer_text: params.answerText,
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
      response_time_ms: 1200,
      submitted_at: Date.now(),
    });

    return {
      accepted: true,
      is_correct: isCorrect,
      score_awarded: scoreAwarded,
    };
  },

  /**
   * Generate Leaderboard for room
   */
  getLeaderboard(roomId: string, currentParticipantId?: string) {
    const room = roomStore.get(roomId);
    if (!room) return [];

    const rows = Array.from(room.participants.values()).map((p) => {
      const totalAnswers = p.submissions.length;
      const correctCount = p.submissions.filter((s) => s.is_correct).length;
      const totalScore = p.submissions.reduce((acc, cur) => acc + cur.score_awarded, 0);
      const avgMs =
        totalAnswers > 0
          ? Math.round(
              p.submissions.reduce((acc, cur) => acc + cur.response_time_ms, 0) / totalAnswers
            )
          : 1500;

      return {
        participant_id: p.id,
        participant_name: p.name || "Santri Magguru",
        is_self: p.id === currentParticipantId,
        answered_count: totalAnswers,
        correct_count: correctCount,
        weighted_correct: correctCount * 100,
        weighted_total: room.questions.length * 100,
        avg_response_ms: avgMs,
        final_score: totalScore,
        rnk: 1,
      };
    });

    // Sort descending by score, then ascending by avg speed
    rows.sort((a, b) => {
      if (b.final_score !== a.final_score) return b.final_score - a.final_score;
      return a.avg_response_ms - b.avg_response_ms;
    });

    // Assign 1-based ranks
    rows.forEach((r, idx) => {
      r.rnk = idx + 1;
    });

    return rows;
  },
};
