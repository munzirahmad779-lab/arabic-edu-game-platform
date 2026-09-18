export type AssessmentType = "toefl_itp" | "toafl" | "custom";

export type SectionType = "listening" | "structure" | "reading";

export type AnswerKey = "A" | "B" | "C" | "D";

export type Assessment = {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  assessment_type: AssessmentType;
  level: string | null;
  is_published: boolean;
  total_duration_minutes: number;
  total_questions: number;
  scoring_config: ScoringConfig;
  created_at: string;
  updated_at: string;
};

export type ScoringConfig = {
  sections?: Array<{
    section_type: SectionType;
    raw_max: number;
    scaled_min: number;
    scaled_max: number;
  }>;
};

export type AssessmentSection = {
  id: string;
  assessment_id: string;
  section_order: number;
  section_type: SectionType;
  title: string;
  instructions: string | null;
  duration_minutes: number;
  audio_play_once: boolean;
  allow_review: boolean;
  question_count: number;
};

export type AssessmentPassage = {
  id: string;
  assessment_id: string;
  section_id: string;
  passage_order: number;
  title: string | null;
  content: string;
};

export type AssessmentAudioGroup = {
  id: string;
  assessment_id: string;
  section_id: string;
  group_order: number;
  title: string | null;
  audio_url: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
};

export type AssessmentQuestion = {
  id: string;
  assessment_id: string;
  section_id: string;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: AnswerKey;
  passage_id: string | null;
  audio_group_id: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
};

export type AssessmentToken = {
  id: string;
  assessment_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
};

export type AssessmentAttempt = {
  id: string;
  attempt_token: string;
  assessment_id: string;
  token_id: string | null;
  student_name: string;
  student_id: string | null;
  started_at: string;
  finished_at: string | null;
  current_section_order: number;
  current_question_number: number;
  raw_listening: number | null;
  raw_structure: number | null;
  raw_reading: number | null;
  score_listening: number | null;
  score_structure: number | null;
  score_reading: number | null;
  score_total: number | null;
  status: "in_progress" | "completed" | "expired";
};

export type AssessmentAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: AnswerKey | null;
  is_correct: boolean | null;
  answered_at: string;
};

export type AssessmentAttemptSection = {
  id: string;
  attempt_id: string;
  section_id: string;
  started_at: string | null;
  finished_at: string | null;
  time_spent_seconds: number | null;
  status: "pending" | "in_progress" | "completed";
};

export const DEFAULT_SECTION_CONFIG: Record<
  AssessmentType,
  Array<{
    section_type: SectionType;
    title: { id: string; en: string; ar: string };
    duration_minutes: number;
    audio_play_once: boolean;
    allow_review: boolean;
    expected_questions: number;
    scaled_min: number;
    scaled_max: number;
  }>
> = {
  toefl_itp: [
    {
      section_type: "listening",
      title: {
        id: "Listening Comprehension",
        en: "Listening Comprehension",
        ar: "فهم المسموع",
      },
      duration_minutes: 35,
      audio_play_once: true,
      allow_review: false,
      expected_questions: 50,
      scaled_min: 31,
      scaled_max: 68,
    },
    {
      section_type: "structure",
      title: {
        id: "Structure & Written Expression",
        en: "Structure & Written Expression",
        ar: "التراكيب والتعبيرات الكتابية",
      },
      duration_minutes: 25,
      audio_play_once: false,
      allow_review: true,
      expected_questions: 40,
      scaled_min: 31,
      scaled_max: 68,
    },
    {
      section_type: "reading",
      title: {
        id: "Reading Comprehension",
        en: "Reading Comprehension",
        ar: "فهم المقروء",
      },
      duration_minutes: 55,
      audio_play_once: false,
      allow_review: true,
      expected_questions: 50,
      scaled_min: 31,
      scaled_max: 67,
    },
  ],
  toafl: [
    {
      section_type: "listening",
      title: {
        id: "Istima' (Fahmul Masmu')",
        en: "Istima' (Listening)",
        ar: "الاستماع (فهم المسموع)",
      },
      duration_minutes: 35,
      audio_play_once: true,
      allow_review: false,
      expected_questions: 50,
      scaled_min: 31,
      scaled_max: 68,
    },
    {
      section_type: "structure",
      title: {
        id: "Tarakib wa Qawaid",
        en: "Structure & Grammar",
        ar: "التراكيب والقواعد",
      },
      duration_minutes: 30,
      audio_play_once: false,
      allow_review: true,
      expected_questions: 40,
      scaled_min: 31,
      scaled_max: 68,
    },
    {
      section_type: "reading",
      title: {
        id: "Qira'ah (Fahmul Maqru')",
        en: "Qira'ah (Reading)",
        ar: "القراءة (فهم المقروء)",
      },
      duration_minutes: 45,
      audio_play_once: false,
      allow_review: true,
      expected_questions: 50,
      scaled_min: 31,
      scaled_max: 67,
    },
  ],
  custom: [
    {
      section_type: "listening",
      title: { id: "Listening", en: "Listening", ar: "الاستماع" },
      duration_minutes: 30,
      audio_play_once: true,
      allow_review: false,
      expected_questions: 20,
      scaled_min: 31,
      scaled_max: 68,
    },
    {
      section_type: "structure",
      title: { id: "Structure", en: "Structure", ar: "التراكيب" },
      duration_minutes: 20,
      audio_play_once: false,
      allow_review: true,
      expected_questions: 20,
      scaled_min: 31,
      scaled_max: 68,
    },
    {
      section_type: "reading",
      title: { id: "Reading", en: "Reading", ar: "القراءة" },
      duration_minutes: 30,
      audio_play_once: false,
      allow_review: true,
      expected_questions: 20,
      scaled_min: 31,
      scaled_max: 67,
    },
  ],
};

export const ASSESSMENT_TYPE_LABEL: Record<
  AssessmentType,
  { id: string; en: string; ar: string }
> = {
  toefl_itp: {
    id: "TOEFL Prediction",
    en: "TOEFL Prediction",
    ar: "توقع TOEFL",
  },
  toafl: {
    id: "TOAFL",
    en: "TOAFL",
    ar: "TOAFL",
  },
  custom: {
    id: "Custom",
    en: "Custom",
    ar: "مخصص",
  },
};

export function generateToken(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateAttemptToken(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}