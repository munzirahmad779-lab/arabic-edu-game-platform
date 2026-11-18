/**
 * Regression: hitungan cakupan modal hapus lewat RPC migrasi
 * 0133 (perbaikan lanjutan perintah pemilik "perbaiki
 * semuanya", 18 Nov 2026 malam).
 *
 * Cacat yang dikunci test ini: paket penjaga hapus (commit
 * 6b0213f) menampilkan hitungan pekerjaan siswa pada modal
 * hapus, tetapi halaman dasbor menghitungnya dengan SELECT
 * langsung memakai klien Supabase guru. RLS tabel pekerjaan
 * siswa tidak mengizinkan guru membaca baris siswa, jadi
 * hitungan diam-diam terbaca 0 padahal datanya ada (modal
 * hapus kelas Mangkoso: "0 jawaban latihan siswa, 0 progres
 * Tugas Susulan, 0 hasil game solo" padahal ada ratusan
 * jawaban; modal hapus bank tidak menampilkan catatan jawaban
 * sama sekali; modal hapus siswa menampilkan 0 progres untuk
 * siswa yang punya baris progres).
 *
 * Perbaikan yang dikunci:
 * 1. Migrasi 0133 membuat empat RPC SECURITY DEFINER
 *    (teacher_scope_counts_class/student/bank/game) dengan
 *    pemeriksaan kepemilikan pola teacher_catchup_overview:
 *    AUTH_REQUIRED bila belum masuk, *_NOT_OWNED bila bukan
 *    milik guru yang masuk, dan grant execute ke
 *    authenticated.
 * 2. Empat halaman dasbor (kelas, siswa, bank soal,
 *    permainan) membaca hitungan modalnya lewat RPC itu dan
 *    tidak lagi menyentuh tabel pekerjaan siswa secara
 *    langsung untuk hitungan ini.
 * 3. Bila RPC gagal, halaman meneruskan nilai kosong
 *    (undefined/null), bukan 0: modal tampil tanpa angka.
 *    Angka 0 hanya boleh tampil bila RPC sungguh menjawab 0.
 * 4. Modal hapus bank dan modal hapus permainan selalu
 *    menampilkan baris hitungannya bila angka diketahui,
 *    termasuk bila 0, dengan penekanan peringatan hanya bila
 *    angkanya lebih dari 0.
 * 5. Tipe keempat RPC terdaftar di src/types/database.ts.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const migration0133 = read(
  "supabase/migrations/0133_hitungan_cakupan_hapus_guru.sql",
);
const classesPage = read("src/app/dashboard/classes/page.tsx");
const deleteClassButton = read(
  "src/app/dashboard/classes/delete-class-button.tsx",
);
const studentsPage = read("src/app/dashboard/students/page.tsx");
const qbPage = read("src/app/dashboard/question-banks/page.tsx");
const deleteBankForm = read(
  "src/app/dashboard/question-banks/delete-bank-form.tsx",
);
const gamesPage = read("src/app/dashboard/games/page.tsx");
const deleteGameButton = read(
  "src/app/dashboard/games/delete-game-button.tsx",
);
const databaseTypes = read("src/types/database.ts");

function sqlTanpaKomentar(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .toLowerCase();
}

const sqlBody = sqlTanpaKomentar(migration0133);

function badanFungsiSql(nama: string): string {
  const mulai = sqlBody.indexOf(
    `create or replace function public.${nama}`,
  );
  assert.notEqual(mulai, -1, `fungsi ${nama} harus ada di 0133`);
  const akhir = sqlBody.indexOf(
    "create or replace function public.",
    mulai + 1,
  );
  return akhir === -1 ? sqlBody.slice(mulai) : sqlBody.slice(mulai, akhir);
}

describe("butir 1: migrasi 0133 membuat empat RPC cakupan", () => {
  test("kepala berkas menjelaskan akar masalah RLS dengan jujur", () => {
    assert.ok(migration0133.includes("AKAR MASALAH"));
    assert.ok(migration0133.includes("RLS"));
    assert.ok(migration0133.includes("diam-diam terbaca 0"));
    assert.ok(migration0133.includes("Belum diterapkan ke produksi"));
  });

  test("keempat fungsi security definer dengan auth wajib", () => {
    for (const nama of [
      "teacher_scope_counts_class",
      "teacher_scope_counts_student",
      "teacher_scope_counts_bank",
      "teacher_scope_counts_game",
    ]) {
      const badan = badanFungsiSql(nama);
      assert.ok(badan.includes("security definer"), nama);
      assert.ok(badan.includes("raise exception 'auth_required'"), nama);
      assert.ok(
        sqlBody.includes(
          `grant execute on function public.${nama}(uuid)`,
        ),
        nama,
      );
      assert.ok(sqlBody.includes("to authenticated"), nama);
    }
  });

  test("pemeriksaan kepemilikan per wilayah memakai token NOT_OWNED", () => {
    assert.ok(
      badanFungsiSql("teacher_scope_counts_class").includes(
        "raise exception 'class_not_owned'",
      ),
    );
    assert.ok(
      badanFungsiSql("teacher_scope_counts_class").includes(
        "c.teacher_id = auth.uid()",
      ),
    );
    assert.ok(
      badanFungsiSql("teacher_scope_counts_student").includes(
        "raise exception 'student_not_owned'",
      ),
    );
    assert.ok(
      badanFungsiSql("teacher_scope_counts_student").includes(
        "join public.classes c on c.id = s.class_id",
      ),
    );
    assert.ok(
      badanFungsiSql("teacher_scope_counts_bank").includes(
        "raise exception 'bank_not_owned'",
      ),
    );
    assert.ok(
      badanFungsiSql("teacher_scope_counts_bank").includes(
        "qb.teacher_id = auth.uid()",
      ),
    );
    assert.ok(
      badanFungsiSql("teacher_scope_counts_game").includes(
        "raise exception 'game_not_owned'",
      ),
    );
    assert.ok(
      badanFungsiSql("teacher_scope_counts_game").includes(
        "g.teacher_id = auth.uid()",
      ),
    );
  });

  test("RPC kelas menghitung siswa dan empat pekerjaan dari tabel yang benar", () => {
    const badan = badanFungsiSql("teacher_scope_counts_class");
    for (const kolom of [
      "students bigint",
      "practice_answers bigint",
      "catchup_progress bigint",
      "solo_results bigint",
      "essay_submissions bigint",
    ]) {
      assert.ok(badan.includes(kolom), kolom);
    }
    for (const tabel of [
      "public.students",
      "public.student_practice_answers",
      "public.student_catchup_progress",
      "public.student_game_results",
      "public.essay_submissions",
    ]) {
      assert.ok(badan.includes(tabel), tabel);
    }
    assert.ok(badan.includes("s.class_id = p_class_id"));
  });

  test("RPC siswa menghitung enam cakupan milik satu siswa", () => {
    const badan = badanFungsiSql("teacher_scope_counts_student");
    for (const kolom of [
      "practice_answers bigint",
      "catchup_progress bigint",
      "attendance bigint",
      "solo_results bigint",
      "post_test_answers bigint",
      "essay_submissions bigint",
    ]) {
      assert.ok(badan.includes(kolom), kolom);
    }
    for (const tabel of [
      "public.student_practice_answers",
      "public.student_catchup_progress",
      "public.student_meeting_attendance",
      "public.student_game_results",
      "public.post_test_answers",
      "public.essay_submissions",
    ]) {
      assert.ok(badan.includes(tabel), tabel);
    }
    assert.ok(badan.includes("student_id = p_student_id"));
  });

  test("RPC bank menghitung soal, submissions, dan jawaban latihan untuk semua soal di bank", () => {
    const badan = badanFungsiSql("teacher_scope_counts_bank");
    for (const kolom of [
      "questions bigint",
      "submissions bigint",
      "practice_answers bigint",
    ]) {
      assert.ok(badan.includes(kolom), kolom);
    }
    assert.ok(badan.includes("q.question_bank_id = p_bank_id"));
    assert.ok(badan.includes("public.submissions"));
    assert.ok(badan.includes("public.student_practice_answers"));
    assert.ok(badan.includes("join public.questions q"));
  });

  test("RPC permainan menghitung sesi arsip dan submissions dari semua room permainan", () => {
    const badan = badanFungsiSql("teacher_scope_counts_game");
    assert.ok(badan.includes("archived_sessions bigint"));
    assert.ok(badan.includes("room_submissions bigint"));
    assert.ok(badan.includes("public.room_sessions"));
    assert.ok(badan.includes("public.submissions"));
    assert.ok(badan.includes("join public.rooms r"));
    assert.ok(badan.includes("r.game_id = p_game_id"));
  });

  test("migrasi murni membaca: tidak ada perintah ubah data", () => {
    assert.equal(sqlBody.includes("delete from"), false);
    assert.equal(sqlBody.includes("insert into"), false);
    assert.equal(sqlBody.includes("update public."), false);
    assert.equal(sqlBody.includes("alter table"), false);
  });
});

describe("butir 2: empat halaman membaca hitungan lewat RPC", () => {
  test("halaman kelas memakai RPC dan tidak lagi SELECT tabel pekerjaan", () => {
    assert.ok(classesPage.includes('"teacher_scope_counts_class"'));
    assert.ok(classesPage.includes("p_class_id: editingClass.id"));
    for (const tabel of [
      "student_practice_answers",
      "student_catchup_progress",
      "student_game_results",
      "essay_submissions",
    ]) {
      assert.equal(classesPage.includes(`.from("${tabel}")`), false, tabel);
    }
    for (const kolom of [
      "row.practice_answers",
      "row.catchup_progress",
      "row.solo_results",
      "row.essay_submissions",
    ]) {
      assert.ok(classesPage.includes(kolom), kolom);
    }
  });

  test("halaman siswa memakai RPC per siswa", () => {
    assert.ok(studentsPage.includes('"teacher_scope_counts_student"'));
    assert.ok(studentsPage.includes("p_student_id: s.id"));
    for (const tabel of [
      "student_practice_answers",
      "student_catchup_progress",
      "student_meeting_attendance",
      "student_game_results",
      "post_test_answers",
      "essay_submissions",
    ]) {
      assert.equal(studentsPage.includes(`.from("${tabel}")`), false, tabel);
    }
  });

  test("halaman bank memakai RPC per bank", () => {
    assert.ok(qbPage.includes('"teacher_scope_counts_bank"'));
    assert.ok(qbPage.includes("p_bank_id: bank.id"));
    assert.equal(qbPage.includes('.from("submissions")'), false);
    assert.equal(
      qbPage.includes('.from("student_practice_answers")'),
      false,
    );
    assert.ok(
      qbPage.includes(
        "submissionCount={bankScopeCounts.get(bank.id)?.submissions}",
      ),
    );
    assert.ok(
      qbPage.includes(
        "practiceAnswerCount={bankScopeCounts.get(bank.id)?.practiceAnswers}",
      ),
    );
  });

  test("halaman permainan memakai RPC per permainan", () => {
    assert.ok(gamesPage.includes('"teacher_scope_counts_game"'));
    assert.ok(gamesPage.includes("p_game_id: game.id"));
    assert.equal(gamesPage.includes('.from("room_sessions")'), false);
    assert.equal(gamesPage.includes('.from("submissions")'), false);
    assert.ok(gamesPage.includes("row.archived_sessions"));
    assert.ok(gamesPage.includes("row.room_submissions"));
  });
});

describe("butir 3: kegagalan RPC tidak menghasilkan angka 0 palsu", () => {
  test("halaman kelas membiarkan deleteCounts null saat RPC gagal", () => {
    assert.ok(
      classesPage.includes(
        "let deleteCounts: ClassDeleteCounts | null = null",
      ),
    );
    assert.ok(classesPage.includes("if (error)"));
    assert.equal(classesPage.includes("practiceAnswers: 0,"), false);
  });

  test("modal kelas hanya menampilkan kotak hitungan bila counts ada", () => {
    assert.ok(deleteClassButton.includes("counts?: ClassDeleteCounts | null"));
    assert.ok(deleteClassButton.includes("{counts ? ("));
  });

  test("halaman siswa tidak mengisi peta hitungan untuk RPC yang gagal", () => {
    assert.ok(studentsPage.includes("if (error)"));
    assert.ok(studentsPage.includes("return null"));
    assert.equal(studentsPage.includes("practiceAnswers: 0,"), false);
  });

  test("halaman bank dan permainan meneruskan undefined, bukan ?? 0", () => {
    assert.equal(qbPage.includes("bankScopeCounts.get(bank.id) ?? 0"), false);
    assert.equal(gamesPage.includes("?.sessions ?? 0"), false);
    assert.equal(gamesPage.includes("?.submissions ?? 0"), false);
  });

  test("modal bank dan permainan tidak lagi memakai bawaan 0 pada props hitungan", () => {
    assert.equal(deleteBankForm.includes("submissionCount = 0"), false);
    assert.equal(deleteBankForm.includes("practiceAnswerCount = 0"), false);
    assert.equal(deleteGameButton.includes("archiveSessionCount = 0"), false);
    assert.equal(
      deleteGameButton.includes("archiveSubmissionCount = 0"),
      false,
    );
  });
});

describe("butir 4: modal bank dan permainan selalu menyebut angka", () => {
  test("modal bank menampilkan kedua baris hitungan dari blok countsKnown", () => {
    assert.ok(deleteBankForm.includes("countsKnown"));
    assert.ok(
      deleteBankForm.includes("Jawaban ruangan yang ikut terhapus:"),
    );
    assert.ok(deleteBankForm.includes("Jawaban latihan siswa:"));
    assert.ok(deleteBankForm.includes("{countsKnown ? ("));
  });

  test("modal bank memberi penekanan peringatan hanya bila ada angka positif", () => {
    assert.ok(deleteBankForm.includes("countsWarn"));
    assert.ok(
      deleteBankForm.includes("submissionCount > 0 || practiceAnswerCount > 0"),
    );
    assert.ok(deleteBankForm.includes("akan ditolak"));
  });

  test("modal permainan menampilkan kedua baris hitungan selalu bila diketahui", () => {
    assert.ok(
      deleteGameButton.includes("Sesi arsip yang ikut terhapus:"),
    );
    assert.ok(
      deleteGameButton.includes("Jawaban ruangan yang ikut terhapus:"),
    );
    assert.ok(
      deleteGameButton.includes(
        'typeof archiveSessionCount === "number"',
      ),
    );
    assert.ok(
      deleteGameButton.includes(
        'typeof archiveSubmissionCount === "number"',
      ),
    );
  });

  test("modal permainan memberi penekanan peringatan hanya bila ada angka positif", () => {
    assert.ok(
      deleteGameButton.includes(
        "archiveSessionCount > 0 || archiveSubmissionCount > 0",
      ),
    );
    assert.ok(deleteGameButton.includes("tidak bisa"));
    assert.ok(deleteGameButton.includes("dikembalikan"));
  });
});

describe("butir 5: tipe RPC terdaftar di database.ts", () => {
  test("keempat RPC cakupan ada dengan kolom hasilnya", () => {
    for (const nama of [
      "teacher_scope_counts_class",
      "teacher_scope_counts_student",
      "teacher_scope_counts_bank",
      "teacher_scope_counts_game",
    ]) {
      assert.ok(databaseTypes.includes(nama), nama);
    }
    assert.ok(databaseTypes.includes("solo_results: number"));
    assert.ok(databaseTypes.includes("archived_sessions: number"));
    assert.ok(databaseTypes.includes("room_submissions: number"));
  });
});

describe("teks baru tanpa em dash", () => {
  test("berkas yang diubah tidak memakai em dash", () => {
    const berkas: Array<[string, string]> = [
      ["migration0133", migration0133],
      ["classesPage", classesPage],
      ["deleteClassButton", deleteClassButton],
      ["studentsPage", studentsPage],
      ["qbPage", qbPage],
      ["deleteBankForm", deleteBankForm],
      ["deleteGameButton", deleteGameButton],
    ];
    for (const [nama, teks] of berkas) {
      assert.equal(teks.includes("—"), false, nama);
    }
    // Halaman permainan punya satu em dash lama di luar wilayah
    // perubahan ini (cadangan nama kelas pada kartu), jadi yang
    // diperiksa hanya blok hitungan arsip barunya.
    const mulai = gamesPage.indexOf("Hitungan arsip per permainan");
    const akhir = gamesPage.indexOf("const getModeLabel");
    assert.ok(mulai > -1 && akhir > mulai);
    assert.equal(gamesPage.slice(mulai, akhir).includes("—"), false);
  });
});
