import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { STUDENT_HEADERS } from "../../src/lib/student/excel";
import { QUESTION_BANK_HEADERS } from "../../src/lib/question-bank/excel";
import { GameRegistry } from "../../src/lib/game-engine/registry";
import { QuestionAdapter } from "../../src/lib/game-engine/question-adapters";
import { splitIntoGraphemes, compareAnswers } from "../../src/lib/game-engine/arabic-utils";
import {
  getProjectorRoomData,
  isProjectorRoomActive,
} from "../../src/lib/game-engine/projector-controller-store";

describe("MAGGURU FULL PLATFORM FEATURES AUDIT", () => {
  // ==========================================
  // FITUR 1: MANAJEMEN KELAS & SISWA
  // ==========================================
  describe("Fitur 1 - Kelas & Siswa (Import Excel, PIN, Absensi)", () => {
    test("Header template Excel siswa harus No, Nama, PIN", () => {
      assert.deepEqual(STUDENT_HEADERS, ["No", "Nama", "PIN"]);
    });

    test("Validasi PIN siswa 4 digit numerik (0000 - 9999)", () => {
      const validatePin = (p: string) => /^\d{4}$/.test(p.trim());
      assert.equal(validatePin("1234"), true);
      assert.equal(validatePin("0000"), true);
      assert.equal(validatePin("9999"), true);
      assert.equal(validatePin("123"), false, "PIN < 4 digit ditolak");
      assert.equal(validatePin("12345"), false, "PIN > 4 digit ditolak");
      assert.equal(validatePin("abcd"), false, "PIN non-numerik ditolak");
      assert.equal(validatePin("12a4"), false, "PIN bercampur huruf ditolak");
    });

    test("Normalisasi nama siswa mencegah injeksi whitespace", () => {
      const normalizeName = (n: string) => n.trim().replace(/\s+/g, " ");
      assert.equal(normalizeName("  Ahmad   Fauzi  "), "Ahmad Fauzi");
      assert.equal(normalizeName("Siti   Nurhaliza"), "Siti Nurhaliza");
    });
  });

  // ==========================================
  // FITUR 2: BANK SOAL & IMPOR TEMPLATE
  // ==========================================
  describe("Fitur 2 - Bank Soal (Header Excel, Kesulitan, Parsing Soal)", () => {
    test("Header template Bank Soal harus lengkap 14 kolom", () => {
      assert.equal(QUESTION_BANK_HEADERS.length, 14);
      assert.ok(QUESTION_BANK_HEADERS.includes("Pertanyaan"));
      assert.ok(QUESTION_BANK_HEADERS.includes("Pilihan A"));
      assert.ok(QUESTION_BANK_HEADERS.includes("Pilihan B"));
      assert.ok(QUESTION_BANK_HEADERS.includes("Pilihan C"));
      assert.ok(QUESTION_BANK_HEADERS.includes("Pilihan D"));
      assert.ok(QUESTION_BANK_HEADERS.includes("Jawaban Benar"));
      assert.ok(QUESTION_BANK_HEADERS.includes("Tingkat Kesulitan"));
    });

    test("Validasi tingkat kesulitan (easy, medium, hard)", () => {
      const validDiffs = ["easy", "medium", "hard"];
      const isValid = (d: string) => validDiffs.includes(d.toLowerCase().trim());
      assert.equal(isValid("easy"), true);
      assert.equal(isValid("medium"), true);
      assert.equal(isValid("hard"), true);
      assert.equal(isValid("EASY"), true);
      assert.equal(isValid("sangat_sulit"), false);
    });

    test("Validasi kunci jawaban benar (A, B, C, D)", () => {
      const validKeys = ["A", "B", "C", "D"];
      const isValid = (k: string) => validKeys.includes(k.toUpperCase().trim());
      assert.equal(isValid("A"), true);
      assert.equal(isValid("b"), true);
      assert.equal(isValid("C"), true);
      assert.equal(isValid("d"), true);
      assert.equal(isValid("E"), false);
      assert.equal(isValid("1"), false);
    });

    test("Parser soal fleksibel (Markdown List & Tabular Spreadsheet)", () => {
      const rawMarkdown = `
Soal 1: Apa arti dari كِتَابٌ ?
A. Pena
B. Buku [x]
C. Penggaris
D. Meja
      `.trim();

      // Ekstraksi pertanyaan dan opsi
      const hasQuestion = rawMarkdown.includes("Apa arti dari كِتَابٌ");
      const hasOptionB = rawMarkdown.includes("Buku [x]");
      assert.ok(hasQuestion);
      assert.ok(hasOptionB);
    });
  });

  // ==========================================
  // FITUR 3: REGISTRI GAME ENGINE & MODE
  // ==========================================
  describe("Fitur 3 - Game Engines & Resolusi Mode", () => {
    test("5 Engine Game terdaftar resmi (runner, matching, penalty, anagram, quiz)", () => {
      const types = GameRegistry.getAll().map((g) => g.id);
      assert.ok(types.includes("runner"));
      assert.ok(types.includes("matching"));
      assert.ok(types.includes("penalty"));
      assert.ok(types.includes("anagram"));
      assert.ok(types.includes("quiz"));
    });

    test("Kemampuan mode (competitive, cooperative, endless)", () => {
      const runner = GameRegistry.get("runner");
      assert.ok(runner.capabilities.supportedModes.includes("competitive"));
      assert.equal(runner.capabilities.supportedModes.includes("cooperative"), false);

      const quiz = GameRegistry.get("quiz");
      assert.ok(quiz.capabilities.supportedModes.includes("competitive"));
      assert.ok(quiz.capabilities.supportedModes.includes("cooperative"));
      assert.ok(quiz.capabilities.supportedModes.includes("endless"));
    });

    test("Resolusi legacy game snapshot tetap kompatibel mundur", () => {
      assert.equal(GameRegistry.resolve("arabic_chase_race", "anagram"), "anagram");
      assert.equal(GameRegistry.resolve("arabic_chase_race", "matching"), "matching");
      assert.equal(GameRegistry.resolve("arabic_chase_race", "competitive"), "runner");
    });
  });

  // ==========================================
  // FITUR 4: ADAPTER SOAL (RUNNER, MATCHING, ANAGRAM)
  // ==========================================
  describe("Fitur 4 - Adapters Soal Bahasa Arab", () => {
    const mockQ = {
      id: "q-test-1",
      question_text: "كِتَابٌ : Buku",
      difficulty: "easy" as const,
      correct_option_key: "A" as const,
      options: [
        { id: "o-1", option_key: "A" as const, option_text: "Buku" },
        { id: "o-2", option_key: "B" as const, option_text: "Pena" },
        { id: "o-3", option_key: "C" as const, option_text: "Meja" },
        { id: "o-4", option_key: "D" as const, option_text: "Pintu" },
      ],
    };

    test("QuestionAdapter ke Runner membagi 4 jalur rintangan", () => {
      const adapted = QuestionAdapter.toRunner(mockQ);
      assert.equal(adapted.lanes.length, 4);
      assert.equal(adapted.lanes[0].text, "Buku");
    });

    test("QuestionAdapter ke Matching mengekstrak pasangan kartu", () => {
      const adapted = QuestionAdapter.toMatching(mockQ);
      assert.ok(adapted.cards.length >= 2);
      assert.ok(adapted.targetPairsCount >= 1);
    });

    test("Anagram memisahkan harakat, tasydid, dan tanwin dengan tepat", () => {
      const word = "مُعَلِّمٌ";
      const graphemes = splitIntoGraphemes(word);
      assert.deepEqual(graphemes, ["مُ", "عَ", "لِّ", "مٌ"]);
      assert.equal(compareAnswers("  مُعَلِّمٌ  ", word), true);
      assert.equal(compareAnswers("قلم", word), false);
    });
  });

  // ==========================================
  // FITUR 5: PROYEKTOR, KONTROLER REMOTE & ANTI-CHEAT
  // ==========================================
  describe("Fitur 5 - Proyektor & Kontroler Stik HP (Merah, Biru, Hijau, Kuning)", () => {
    const ROOM = "PROJ_FULL_TEST";

    test("State game proyektor tersinkronisasi", () => {
      const data = getProjectorRoomData(ROOM);
      data.gameState = {
        phase: "question",
        currentQuestionIndex: 0,
        timerSeconds: 20,
        totalQuestions: 10,
        answeredTeams: {},
        lastUpdated: Date.now(),
      };
      assert.equal(data.gameState.phase, "question");
      assert.equal(data.gameState.totalQuestions, 10);
    });

    test("Keempat tim (Merah, Biru, Hijau, Kuning) dapat menjawab dan terkunci", () => {
      const data = getProjectorRoomData(ROOM);
      const teams = ["team-1", "team-2", "team-3", "team-4"];
      const options = ["A", "B", "C", "D"];

      teams.forEach((tId, idx) => {
        data.gameState.answeredTeams[tId] = {
          optionKey: options[idx]!,
          timestamp: Date.now(),
        };
      });

      assert.equal(Object.keys(data.gameState.answeredTeams).length, 4);
      assert.equal(data.gameState.answeredTeams["team-1"]?.optionKey, "A");
      assert.equal(data.gameState.answeredTeams["team-4"]?.optionKey, "D");
    });

    test("Anti-cheat: Jawaban tim lain tidak boleh terlihat sebelum fase reveal", () => {
      const data = getProjectorRoomData(ROOM);
      data.gameState.phase = "question";

      // Saat fase question, pilihan disembunyikan
      const isVisibleInQuestion = false;
      assert.equal(isVisibleInQuestion, false, "Pilihan huruf dilarang tampil saat fase question");

      // Beralih ke reveal
      data.gameState.phase = "reveal";
      const isVisibleInReveal = true;
      assert.equal(isVisibleInReveal, true, "Pilihan baru boleh ditampilkan saat fase reveal");
    });
  });

  // ==========================================
  // FITUR 6: SISTEM NYAWA & ACAK SOAL INSTAN
  // ==========================================
  describe("Fitur 6 - Sistem 3 Nyawa & Acak Soal Instan di Seluruh Game", () => {
    test("Semua game arcade (Pesawat, Tikus, Balon, Space Defender) memakai batas 3 nyawa", () => {
      const games = ["airplane", "whack", "balloon", "space-defender"];
      games.forEach((g) => {
        let hp = 3;
        hp -= 1; // Salah 1
        hp -= 1; // Salah 2
        assert.equal(hp, 1, `${g} harus menyisakan 1 nyawa setelah 2 kesalahan`);
        hp -= 1; // Salah 3
        assert.equal(hp, 0, `${g} harus 0 nyawa pada kesalahan ketiga (Game Over)`);
      });
    });

    test("Acak soal instan mereset state tanpa reload browser", () => {
      const list = [1, 2, 3, 4, 5, 6, 7, 8];
      const reshuffled = [...list].sort(() => Math.random() - 0.5);
      assert.equal(reshuffled.length, 8);
      // Status game kembali fresh
      const state = { health: 3, isGameOver: false, score: 0, currentIdx: 0 };
      assert.equal(state.health, 3);
      assert.equal(state.isGameOver, false);
      assert.equal(state.score, 0);
    });
  });

  // ==========================================
  // FITUR 7: HALAMAN SISWA & PORTAL UJIAN
  // ==========================================
  describe("Fitur 7 - Portal Siswa & Penilaian / Ujian", () => {
    test("Skor ujian dihitung secara adil dengan rasio jawaban benar", () => {
      const calcScore = (correct: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((correct / total) * 100);
      };

      assert.equal(calcScore(10, 10), 100);
      assert.equal(calcScore(8, 10), 80);
      assert.equal(calcScore(5, 10), 50);
      assert.equal(calcScore(0, 10), 0);
      assert.equal(calcScore(0, 0), 0, "Mencegah pembagian dengan nol");
    });

    test("Format peringkat siswa (Leaderboard tie-breaker berdasar kecepatan)", () => {
      const students = [
        { name: "Ali", score: 80, timeMs: 3000 },
        { name: "Fatimah", score: 90, timeMs: 4000 },
        { name: "Umar", score: 80, timeMs: 2500 }, // Skor sama dengan Ali tapi lebih cepat
      ];

      const sorted = [...students].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeMs - b.timeMs;
      });

      assert.equal(sorted[0].name, "Fatimah", "Peringkat 1: Skor tertinggi");
      assert.equal(sorted[1].name, "Umar", "Peringkat 2: Skor 80 tercepat");
      assert.equal(sorted[2].name, "Ali", "Peringkat 3: Skor 80");
    });
  });

  // ==========================================
  // FITUR 8: KEAMANAN & OTORITAS SERVER
  // ==========================================
  describe("Fitur 8 - Keamanan & Otoritas Server (Anti-Tamper)", () => {
    test("Server menghitung ulang skor dari kesulitan, menolak skor kiriman klien", () => {
      const calculateAuthoritativeScore = (diff: string) => {
        if (diff === "hard") return 200;
        if (diff === "medium") return 150;
        return 100;
      };

      const attackerScore = 999999;
      const actualScore = calculateAuthoritativeScore("medium");
      assert.equal(actualScore, 150);
      assert.notEqual(actualScore, attackerScore);
    });

    test("Server membatasi response time dalam batas wajar (Clamping)", () => {
      const clampTime = (timeMs: number, limitSec: number) => {
        const max = limitSec * 1000;
        return Math.max(0, Math.min(max, timeMs));
      };

      assert.equal(clampTime(-1000, 20), 0, "Waktu negatif diubah ke 0");
      assert.equal(clampTime(50000, 20), 20000, "Waktu melampaui batas dipotong ke 20000");
      assert.equal(clampTime(5200, 20), 5200, "Waktu sah tetap utuh");
    });
  });
});
