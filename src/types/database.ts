/**
 * Hand-written Supabase Database type, kept in sync with
 * supabase/migrations/0001_init_schema.sql.
 *
 * Once a real Supabase project exists, this should be regenerated with:
 *   supabase gen types typescript --project-id <id> > src/types/database.ts
 * and this file replaced. Until then, this file is the single source of
 * truth for query type-safety and MUST be updated by hand alongside any
 * migration change.
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

/**
 * Every table's `Relationships` array below matches postgrest-js's
 * GenericRelationship shape:
 *   { foreignKeyName: string; columns: string[]; isOneToOne?: boolean;
 *     referencedRelation: string; referencedColumns: string[] }
 * It is intentionally written as inline literal objects rather than typed
 * against a shared interface â€” typing them against a widened `string`-based
 * interface would lose the literal string types postgrest-js needs to
 * resolve embedded-resource (join) queries correctly.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: ProfileRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      students: {
        Row: {
          id: string;
          class_id: string;
          name: string;
          pin_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          name: string;
          pin_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          name?: string;
          pin_hash?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          }
        ];
      };
      question_categories: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_categories_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      questions: {
        Row: {
          id: string;
          teacher_id: string;
          category_id: string | null;
          type: QuestionType;
          payload: Json;
          explanation: string | null;
          tags: string[];
          media_url: string | null;
          question_bank_id: string | null;
          question_text: string | null;
          difficulty: QuestionDifficulty | null;
          correct_option_key: QuestionOptionKey | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          category_id?: string | null;
          type?: QuestionType;
          payload: Json;
          explanation?: string | null;
          tags?: string[];
          media_url?: string | null;
          question_bank_id?: string | null;
          question_text?: string | null;
          difficulty?: QuestionDifficulty | null;
          correct_option_key?: QuestionOptionKey | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          category_id?: string | null;
          type?: QuestionType;
          payload?: Json;
          explanation?: string | null;
          tags?: string[];
          media_url?: string | null;
          question_bank_id?: string | null;
          question_text?: string | null;
          difficulty?: QuestionDifficulty | null;
          correct_option_key?: QuestionOptionKey | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "question_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_question_bank_id_fkey";
            columns: ["question_bank_id"];
            isOneToOne: false;
            referencedRelation: "question_banks";
            referencedColumns: ["id"];
          }
        ];
      };
      question_banks: {
        Row: {
          id: string;
          teacher_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_banks_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      question_options: {
        Row: {
          id: string;
          question_id: string;
          option_key: QuestionOptionKey;
          option_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          option_key: QuestionOptionKey;
          option_text: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          option_key?: QuestionOptionKey;
          option_text?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
      question_media: {
        Row: {
          id: string;
          question_id: string;
          media_type: QuestionMediaType;
          expected_filename: string;
          storage_path: string | null;
          original_filename: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          max_play_count: number | null;
          attached_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          media_type: QuestionMediaType;
          expected_filename: string;
          storage_path?: string | null;
          original_filename?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          max_play_count?: number | null;
          attached_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          media_type?: QuestionMediaType;
          expected_filename?: string;
          storage_path?: string | null;
          original_filename?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          max_play_count?: number | null;
          attached_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_media_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
      question_bank_shares: {
        Row: {
          id: string;
          question_bank_id: string;
          owner_id: string;
          shared_with_user_id: string;
          status: "active" | "revoked";
          created_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          question_bank_id: string;
          owner_id: string;
          shared_with_user_id: string;
          status?: "active" | "revoked";
          created_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          question_bank_id?: string;
          owner_id?: string;
          shared_with_user_id?: string;
          status?: "active" | "revoked";
          created_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_bank_shares_question_bank_id_fkey";
            columns: ["question_bank_id"];
            isOneToOne: false;
            referencedRelation: "question_banks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_bank_shares_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_bank_shares_shared_with_user_id_fkey";
            columns: ["shared_with_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      games: {
        Row: {
          id: string;
          teacher_id: string;
          class_id: string | null;
          name: string;
          game_type: GameType;
          mode: GameMode;
          duration_seconds: number;
          ranking_visibility: RankingVisibility;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          class_id?: string | null;
          name: string;
          game_type?: GameType;
          mode: GameMode;
          duration_seconds: number;
          ranking_visibility?: RankingVisibility;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          class_id?: string | null;
          name?: string;
          game_type?: GameType;
          mode?: GameMode;
          duration_seconds?: number;
          ranking_visibility?: RankingVisibility;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          }
        ];
      };
      game_questions: {
        Row: {
          id: string;
          game_id: string;
          question_id: string;
          position: number;
          explanation_timing: ExplanationTiming;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          question_id: string;
          position: number;
          explanation_timing?: ExplanationTiming;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          question_id?: string;
          position?: number;
          explanation_timing?: ExplanationTiming;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_questions_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_questions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
      rooms: {
        Row: {
          id: string;
          code: string;
          teacher_id: string;
          game_id: string | null;
          class_id: string | null;
          state: RoomState;
          snapshot: Json;
          capacity: number;
          current_question_index: number;
          question_started_at: string | null;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          teacher_id: string;
          game_id?: string | null;
          class_id?: string | null;
          state?: RoomState;
          snapshot: Json;
          capacity?: number;
          current_question_index?: number;
          question_started_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          teacher_id?: string;
          game_id?: string | null;
          class_id?: string | null;
          state?: RoomState;
          snapshot?: Json;
          capacity?: number;
          current_question_index?: number;
          question_started_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rooms_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          }
        ];
      };
      room_participants: {
        Row: {
          id: string;
          room_id: string;
          student_id: string | null;
          guest_name: string | null;
          connection_state: ConnectionState;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          student_id?: string | null;
          guest_name?: string | null;
          connection_state?: ConnectionState;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          student_id?: string | null;
          guest_name?: string | null;
          connection_state?: ConnectionState;
          joined_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "room_participants_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      submissions: {
        Row: {
          id: string;
          room_id: string;
          room_participant_id: string;
          question_id: string;
          selected_option_id: string;
          is_correct: boolean;
          response_time_ms: number;
          score_awarded: number;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          room_participant_id: string;
          question_id: string;
          selected_option_id: string;
          is_correct: boolean;
          response_time_ms: number;
          score_awarded: number;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          room_participant_id?: string;
          question_id?: string;
          selected_option_id?: string;
          is_correct?: boolean;
          response_time_ms?: number;
          score_awarded?: number;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_room_participant_id_fkey";
            columns: ["room_participant_id"];
            isOneToOne: false;
            referencedRelation: "room_participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "submissions_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      import_question_bank_rows: {
        Args: {
          p_question_bank_id: string;
          p_rows: Json;
        };
        Returns: number;
      };
      update_question_bank_question: {
        Args: {
          p_question_id: string;
          p_category_id: string;
          p_question_text: string;
          p_difficulty: string;
          p_correct_option_key: string;
          p_options: Json;
        };
        Returns: boolean;
      };
      delete_question_bank_question: {
        Args: {
          p_question_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
  };
}

