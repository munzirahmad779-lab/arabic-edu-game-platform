/**
 * Hand-written Supabase Database type.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ExplanationTiming = "after_each_question" | "after_game_only" | "never";
export type GameMode = "competitive" | "learning";
export type GameType = "arabic_chase_race";
export type QuestionType = "mcq";
export type RankingVisibility = "full" | "hidden" | "self_only";
export type RoomState = "waiting" | "running" | "ended" | "locked";
export type ConnectionState = "connected" | "disconnected";
export type ProfileRole = "teacher" | "admin";
export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionOptionKey = "A" | "B" | "C" | "D";
export type QuestionMediaType = "audio" | "image" | "video";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; role: ProfileRole; created_at: string; updated_at: string; };
        Insert: { id: string; email: string; full_name?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; email?: string; full_name?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [];
      };
      classes: {
        Row: { id: string; teacher_id: string; name: string; subject: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; teacher_id: string; name: string; subject?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; teacher_id?: string; name?: string; subject?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: "classes_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; }];
      };
      students: {
        Row: { id: string; class_id: string; name: string; pin_hash: string; pin_plain: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; class_id: string; name: string; pin_hash: string; pin_plain?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; class_id?: string; name?: string; pin_hash?: string; pin_plain?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: "students_class_id_fkey"; columns: ["class_id"]; isOneToOne: false; referencedRelation: "classes"; referencedColumns: ["id"]; }];
      };
      question_categories: {
        Row: { id: string; teacher_id: string; name: string; created_at: string; updated_at: string; };
        Insert: { id?: string; teacher_id: string; name: string; created_at?: string; updated_at?: string; };
        Update: { id?: string; teacher_id?: string; name?: string; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: "question_categories_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; }];
      };
      questions: {
        Row: { id: string; teacher_id: string; category_id: string | null; type: QuestionType; payload: Json; explanation: string | null; tags: string[]; media_url: string | null; question_bank_id: string | null; question_text: string | null; difficulty: QuestionDifficulty | null; correct_option_key: QuestionOptionKey | null; created_at: string; updated_at: string; };
        Insert: { id?: string; teacher_id: string; category_id?: string | null; type?: QuestionType; payload: Json; explanation?: string | null; tags?: string[]; media_url?: string | null; question_bank_id?: string | null; question_text?: string | null; difficulty?: QuestionDifficulty | null; correct_option_key?: QuestionOptionKey | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; teacher_id?: string; category_id?: string | null; type?: QuestionType; payload?: Json; explanation?: string | null; tags?: string[]; media_url?: string | null; question_bank_id?: string | null; question_text?: string | null; difficulty?: QuestionDifficulty | null; correct_option_key?: QuestionOptionKey | null; created_at?: string; updated_at?: string; };
        Relationships: [
          { foreignKeyName: "questions_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; },
          { foreignKeyName: "questions_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "question_categories"; referencedColumns: ["id"]; },
          { foreignKeyName: "questions_question_bank_id_fkey"; columns: ["question_bank_id"]; isOneToOne: false; referencedRelation: "question_banks"; referencedColumns: ["id"]; }
        ];
      };
      question_banks: {
        Row: { id: string; teacher_id: string; name: string; description: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; teacher_id: string; name: string; description?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; teacher_id?: string; name?: string; description?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: "question_banks_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; }];
      };
      question_options: {
        Row: { id: string; question_id: string; option_key: QuestionOptionKey; option_text: string; created_at: string; updated_at: string; };
        Insert: { id?: string; question_id: string; option_key: QuestionOptionKey; option_text: string; created_at?: string; updated_at?: string; };
        Update: { id?: string; question_id?: string; option_key?: QuestionOptionKey; option_text?: string; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: "question_options_question_id_fkey"; columns: ["question_id"]; isOneToOne: false; referencedRelation: "questions"; referencedColumns: ["id"]; }];
      };
      question_media: {
        Row: { id: string; question_id: string; media_type: QuestionMediaType; expected_filename: string; storage_path: string | null; original_filename: string | null; mime_type: string | null; size_bytes: number | null; max_play_count: number | null; attached_at: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; question_id: string; media_type: QuestionMediaType; expected_filename: string; storage_path?: string | null; original_filename?: string | null; mime_type?: string | null; size_bytes?: number | null; max_play_count?: number | null; attached_at?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; question_id?: string; media_type?: QuestionMediaType; expected_filename?: string; storage_path?: string | null; original_filename?: string | null; mime_type?: string | null; size_bytes?: number | null; max_play_count?: number | null; attached_at?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: "question_media_question_id_fkey"; columns: ["question_id"]; isOneToOne: false; referencedRelation: "questions"; referencedColumns: ["id"]; }];
      };
      question_bank_shares: {
        Row: { id: string; question_bank_id: string; owner_id: string; shared_with_user_id: string; status: "active" | "revoked"; created_at: string; revoked_at: string | null; };
        Insert: { id?: string; question_bank_id: string; owner_id: string; shared_with_user_id: string; status?: "active" | "revoked"; created_at?: string; revoked_at?: string | null; };
        Update: { id?: string; question_bank_id?: string; owner_id?: string; shared_with_user_id?: string; status?: "active" | "revoked"; created_at?: string; revoked_at?: string | null; };
        Relationships: [
          { foreignKeyName: "question_bank_shares_question_bank_id_fkey"; columns: ["question_bank_id"]; isOneToOne: false; referencedRelation: "question_banks"; referencedColumns: ["id"]; },
          { foreignKeyName: "question_bank_shares_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; },
          { foreignKeyName: "question_bank_shares_shared_with_user_id_fkey"; columns: ["shared_with_user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; }
        ];
      };
      games: {
        Row: { id: string; teacher_id: string; class_id: string | null; name: string; game_type: GameType; mode: GameMode; duration_seconds: number; ranking_visibility: RankingVisibility; created_at: string; updated_at: string; };
        Insert: { id?: string; teacher_id: string; class_id?: string | null; name: string; game_type?: GameType; mode: GameMode; duration_seconds: number; ranking_visibility?: RankingVisibility; created_at?: string; updated_at?: string; };
        Update: { id?: string; teacher_id?: string; class_id?: string | null; name?: string; game_type?: GameType; mode?: GameMode; duration_seconds?: number; ranking_visibility?: RankingVisibility; created_at?: string; updated_at?: string; };
        Relationships: [
          { foreignKeyName: "games_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; },
          { foreignKeyName: "games_class_id_fkey"; columns: ["class_id"]; isOneToOne: false; referencedRelation: "classes"; referencedColumns: ["id"]; }
        ];
      };
      game_questions: {
        Row: { id: string; game_id: string; question_id: string; position: number; explanation_timing: ExplanationTiming; created_at: string; };
        Insert: { id?: string; game_id: string; question_id: string; position: number; explanation_timing?: ExplanationTiming; created_at?: string; };
        Update: { id?: string; game_id?: string; question_id?: string; position?: number; explanation_timing?: ExplanationTiming; created_at?: string; };
        Relationships: [
          { foreignKeyName: "game_questions_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "games"; referencedColumns: ["id"]; },
          { foreignKeyName: "game_questions_question_id_fkey"; columns: ["question_id"]; isOneToOne: false; referencedRelation: "questions"; referencedColumns: ["id"]; }
        ];
      };
      rooms: {
        Row: { id: string; code: string; teacher_id: string; game_id: string | null; class_id: string | null; state: RoomState; snapshot: Json; capacity: number; current_question_index: number; question_started_at: string | null; started_at: string | null; ended_at: string | null; created_at: string; updated_at: string; };
        Insert: { id?: string; code: string; teacher_id: string; game_id?: string | null; class_id?: string | null; state?: RoomState; snapshot: Json; capacity?: number; current_question_index?: number; question_started_at?: string | null; started_at?: string | null; ended_at?: string | null; created_at?: string; updated_at?: string; };
        Update: { id?: string; code?: string; teacher_id?: string; game_id?: string | null; class_id?: string | null; state?: RoomState; snapshot?: Json; capacity?: number; current_question_index?: number; question_started_at?: string | null; started_at?: string | null; ended_at?: string | null; created_at?: string; updated_at?: string; };
        Relationships: [
          { foreignKeyName: "rooms_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"]; },
          { foreignKeyName: "rooms_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "games"; referencedColumns: ["id"]; },
          { foreignKeyName: "rooms_class_id_fkey"; columns: ["class_id"]; isOneToOne: false; referencedRelation: "classes"; referencedColumns: ["id"]; }
        ];
      };
      room_participants: {
        Row: { id: string; room_id: string; student_id: string | null; guest_name: string | null; connection_state: ConnectionState; joined_at: string; last_seen_at: string; };
        Insert: { id?: string; room_id: string; student_id?: string | null; guest_name?: string | null; connection_state?: ConnectionState; joined_at?: string; last_seen_at?: string; };
        Update: { id?: string; room_id?: string; student_id?: string | null; guest_name?: string | null; connection_state?: ConnectionState; joined_at?: string; last_seen_at?: string; };
        Relationships: [
          { foreignKeyName: "room_participants_room_id_fkey"; columns: ["room_id"]; isOneToOne: false; referencedRelation: "rooms"; referencedColumns: ["id"]; },
          { foreignKeyName: "room_participants_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "students"; referencedColumns: ["id"]; }
        ];
      };
      submissions: {
        Row: { id: string; room_id: string; room_participant_id: string; question_id: string; selected_option_id: string; is_correct: boolean; response_time_ms: number; score_awarded: number; submitted_at: string; };
        Insert: { id?: string; room_id: string; room_participant_id: string; question_id: string; selected_option_id: string; is_correct: boolean; response_time_ms: number; score_awarded: number; submitted_at?: string; };
        Update: { id?: string; room_id?: string; room_participant_id?: string; question_id?: string; selected_option_id?: string; is_correct?: boolean; response_time_ms?: number; score_awarded?: number; submitted_at?: string; };
        Relationships: [
          { foreignKeyName: "submissions_room_id_fkey"; columns: ["room_id"]; isOneToOne: false; referencedRelation: "rooms"; referencedColumns: ["id"]; },
          { foreignKeyName: "submissions_room_participant_id_fkey"; columns: ["room_participant_id"]; isOneToOne: false; referencedRelation: "room_participants"; referencedColumns: ["id"]; },
          { foreignKeyName: "submissions_question_id_fkey"; columns: ["question_id"]; isOneToOne: false; referencedRelation: "questions"; referencedColumns: ["id"]; }
        ];
      };
      class_materials: {
        Row: { id: string; class_id: string; title: string; content_json: Json | null; youtube_url: string | null; image_path: string | null; pdf_path: string | null; position: number; is_published: boolean; created_at: string; updated_at: string; };
        Insert: { id?: string; class_id: string; title: string; content_json?: Json | null; youtube_url?: string | null; image_path?: string | null; pdf_path?: string | null; position?: number; is_published?: boolean; created_at?: string; updated_at?: string; };
        Update: { id?: string; class_id?: string; title?: string; content_json?: Json | null; youtube_url?: string | null; image_path?: string | null; pdf_path?: string | null; position?: number; is_published?: boolean; created_at?: string; updated_at?: string; };
        Relationships: [{ foreignKeyName: "class_materials_class_id_fkey"; columns: ["class_id"]; isOneToOne: false; referencedRelation: "classes"; referencedColumns: ["id"]; }];
      };
      student_sessions: {
        Row: { id: string; student_id: string; token_hash: string; expires_at: string; created_at: string; last_seen_at: string; };
        Insert: { id?: string; student_id: string; token_hash: string; expires_at: string; created_at?: string; last_seen_at?: string; };
        Update: { id?: string; student_id?: string; token_hash?: string; expires_at?: string; created_at?: string; last_seen_at?: string; };
        Relationships: [{ foreignKeyName: "student_sessions_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "students"; referencedColumns: ["id"]; }];
      };
      login_attempts: {
        Row: { id: string; identifier: string; success: boolean; attempted_at: string; };
        Insert: { id?: string; identifier: string; success: boolean; attempted_at?: string; };
        Update: { id?: string; identifier?: string; success?: boolean; attempted_at?: string; };
        Relationships: [];
      };
      room_sessions: {
        Row: { id: string; room_id: string; session_number: number; started_at: string | null; ended_at: string | null; created_at: string; };
        Insert: { id?: string; room_id: string; session_number: number; started_at?: string | null; ended_at?: string | null; created_at?: string; };
        Update: { id?: string; room_id?: string; session_number?: number; started_at?: string | null; ended_at?: string | null; created_at?: string; };
        Relationships: [{ foreignKeyName: "room_sessions_room_id_fkey"; columns: ["room_id"]; isOneToOne: false; referencedRelation: "rooms"; referencedColumns: ["id"]; }];
      };
      room_session_participants: {
        Row: { id: string; session_id: string; participant_name: string; final_score: number; rank: number; correct_count: number; total_questions: number; avg_response_ms: number; created_at: string; };
        Insert: { id?: string; session_id: string; participant_name: string; final_score: number; rank: number; correct_count: number; total_questions: number; avg_response_ms?: number; created_at?: string; };
        Update: { id?: string; session_id?: string; participant_name?: string; final_score?: number; rank?: number; correct_count?: number; total_questions?: number; avg_response_ms?: number; created_at?: string; };
        Relationships: [{ foreignKeyName: "room_session_participants_session_id_fkey"; columns: ["session_id"]; isOneToOne: false; referencedRelation: "room_sessions"; referencedColumns: ["id"]; }];
      };
      teacher_audio_settings: {
        Row: { teacher_id: string; enabled: boolean; audio_path: string | null; audio_url: string | null; volume: number; play_on_dashboard: boolean; play_on_login: boolean; play_on_student: boolean; play_on_game: boolean; play_on_final: boolean; updated_at: string; };
        Insert: { teacher_id: string; enabled?: boolean; audio_path?: string | null; audio_url?: string | null; volume?: number; play_on_dashboard?: boolean; play_on_login?: boolean; play_on_student?: boolean; play_on_game?: boolean; play_on_final?: boolean; updated_at?: string; };
        Update: { teacher_id?: string; enabled?: boolean; audio_path?: string | null; audio_url?: string | null; volume?: number; play_on_dashboard?: boolean; play_on_login?: boolean; play_on_student?: boolean; play_on_game?: boolean; play_on_final?: boolean; updated_at?: string; };
        Relationships: [
          { foreignKeyName: "teacher_audio_settings_teacher_id_fkey"; columns: ["teacher_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"]; }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      game_time_limit_for_difficulty: { Args: { p_difficulty: string }; Returns: number; };
      game_weight_for_difficulty: { Args: { p_difficulty: string }; Returns: number; };
      game_total_weight: { Args: { p_questions: Json }; Returns: number; };
      game_avg_limit_ms: { Args: { p_questions: Json }; Returns: number; };
      import_question_bank_rows: { Args: { p_question_bank_id: string; p_rows: Json; }; Returns: number; };
      update_question_bank_question: { Args: { p_question_id: string; p_category_id: string; p_question_text: string; p_difficulty: string; p_correct_option_key: string; p_options: Json; }; Returns: boolean; };
      delete_question_bank_question: { Args: { p_question_id: string; }; Returns: boolean; };
      delete_question_bank: { Args: { p_bank_id: string; }; Returns: undefined; };
      import_students_to_class: {
        Args: { p_class_id: string; p_names: Json; };
        Returns: Array<{ student_name: string; student_pin: string; }>;
      };
      get_game_session: {
        Args: { p_join_token: string };
        Returns: Array<{
          room_id: string; room_code: string; game_name: string; room_state: string;
          participant_id: string; participant_name: string | null;
          participant_count: number; capacity: number; duration_seconds: number;
          question_index: number; question_count: number;
          question_started_at: string | null; question: Json | null;
          answer_submitted: boolean; server_time: string;
        }>;
      };
      submit_game_answer: {
        Args: { p_join_token: string; p_question_id: string; p_selected_option_id: string; };
        Returns: Array<{
          accepted: boolean; is_correct: boolean; score_awarded: number;
          response_time_ms: number; room_state: string; next_question_index: number;
        }>;
      };
      get_room_leaderboard_student: {
        Args: { p_join_token: string };
        Returns: Array<{
          participant_id: string; participant_name: string; is_self: boolean;
          answered_count: number; correct_count: number;
          weighted_correct: number; weighted_total: number;
          avg_response_ms: number; final_score: number; rnk: number;
        }>;
      };
      get_room_leaderboard_teacher: {
        Args: { p_room_id: string };
        Returns: Array<{
          participant_id: string; participant_name: string; is_self: boolean;
          answered_count: number; correct_count: number;
          weighted_correct: number; weighted_total: number;
          avg_response_ms: number; final_score: number; rnk: number;
        }>;
      };
      heartbeat_room_participant: {
        Args: { p_join_token: string };
        Returns: undefined;
      };
      archive_room_session: {
        Args: { p_room_id: string };
        Returns: string;
      };
      list_room_sessions: {
        Args: { p_room_id: string };
        Returns: Array<{
          session_id: string;
          session_number: number;
          started_at: string | null;
          ended_at: string | null;
          participant_count: number;
        }>;
      };
      get_room_session_detail: {
        Args: { p_session_id: string };
        Returns: Array<{
          participant_name: string;
          final_score: number;
          rank: number;
          correct_count: number;
          total_questions: number;
          avg_response_ms: number;
        }>;
      };
      student_login: { Args: { p_name: string; p_pin: string; p_ip: string; }; Returns: Array<{ token: string; student_id: string; name: string; class_id: string; class_name: string; }>; };
      verify_student_session: { Args: { p_token: string; }; Returns: Array<{ student_id: string; name: string; class_id: string; class_name: string; }>; };
      student_list_materials: { Args: { p_token: string; p_class_id: string; }; Returns: Array<{ id: string; title: string; position: number; updated_at: string; }>; };
      student_get_material: {
        Args: { p_token: string; p_material_id: string; };
        Returns: Array<{ id: string; class_id: string; title: string; content_json: Json | null; youtube_url: string | null; image_path: string | null; pdf_path: string | null; updated_at: string; }>;
      };
      student_logout: { Args: { p_token: string; }; Returns: undefined; };
    };
    Enums: Record<string, never>;
  };
}