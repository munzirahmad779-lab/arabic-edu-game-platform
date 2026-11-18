/**
 * Regression: paket penjaga hapus dasbor guru (perintah pemilik
 * "perbaiki semuanya", 18 Nov 2026).
 *
 * Temuan audit yang dikunci test ini:
 * 1. deleteClass menjalankan cascade yang menghapus seluruh
 *    siswa dan pekerjaan mereka tanpa penjaga; kini server
 *    mewajibkan pengetikan nama kelas persis dan modal
 *    menampilkan hitungan isi kelas.
 * 2. Modal hapus siswa kini mengungkapkan hitungan data siswa
 *    yang ikut terhapus (enam tabel pekerjaan).
 * 3. deleteEssay menghitung essay_submissions lebih dulu dan
 *    membatalkan bila sudah ada esai terkumpul.
 * 4. Modal hapus permainan menyebutkan jumlah sesi arsip dan
 *    submissions ruangan yang ikut terhapus.
 * 5. Modal hapus materi memperingatkan bila materi adalah
 *    bahan Langkah Baca Tugas Susulan sebuah dars.
 * 6. Migrasi 0130: FK post_test_answers.question_id menjadi
 *    ON DELETE RESTRICT (pola katalog sistem 0127/0129).
 * 7. Migrasi 0131: RPC delete_question_bank menolak bank yang
 *    sudah mempunyai jawaban latihan siswa, dengan pesan
 *    Bahasa Indonesia; langkah lain 0024 dipertahankan.
 * 8. Sisi aplikasi hapus bank menerjemahkan galat RPC menjadi
 *    pesan jelas dan modalnya menampilkan hitungan soal,
 *    submissions, dan jawaban latihan.
 * 9. Migrasi 0132 + halaman guru: RPC
 *    teacher_catchup_progress_detail memunculkan siswa yang
 *    sedang berproses tetapi belum lulus.
 * 10. Seed post tes 15 soal ditulis ulang sebagai upsert per
 *     nomor urut tanpa perintah hapus apa pun.
 * 12. Penjaga asesmen: deleteAssessment menolak bila sudah ada
 *     attempt; impor ulang workbook menolak bila soal lama
 *     sudah mempunyai jawaban siswa (rantai FK asesmen di
 *     produksi terverifikasi CASCADE).
 * 13. Perbaikan lanjutan (18 Nov 2026 malam): hitungan modal
 *     kelas, siswa, bank, dan permainan tidak lagi dibaca
 *     dengan SELECT langsung ke tabel pekerjaan siswa (RLS
 *     membuatnya diam-diam 0), melainkan lewat RPC migrasi
 *     0133. Asersi butir 1, 2, 4, dan 8 di berkas ini diperbarui
 *     ke jalur RPC; rincian 0133 dikunci di berkas tes
 *     hitungan-cakupan-hapus-rpc.test.ts.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const classesActions = read("src/app/dashboard/classes/actions.ts");
const classesPage = read("src/app/dashboard/classes/page.tsx");
const deleteClassButton = read(
  "src/app/dashboard/classes/delete-class-button.tsx",
);
const studentsPage = read("src/app/dashboard/students/page.tsx");
const deleteStudentButton = read(
  "src/app/dashboard/students/delete-student-button.tsx",
);
const idDict = JSON.parse(read("src/lib/i18n/id.json")) as {
  class_detail: { delete_student_confirm: string };
};
const essayActions = read(
  "src/app/dashboard/classes/[classId]/essay-actions.ts",
);
const classDetailPage = read("src/app/dashboard/classes/[classId]/page.tsx");
const materialList = read(
  "src/app/dashboard/classes/[classId]/material-sortable-list.tsx",
);
const gamesPage = read("src/app/dashboard/games/page.tsx");
const gameCardActions = read("src/app/dashboard/games/game-card-actions.tsx");
const deleteGameButton = read("src/app/dashboard/games/delete-game-button.tsx");
const qbActions = read("src/app/dashboard/question-banks/actions.ts");
const qbPage = read("src/app/dashboard/question-banks/page.tsx");
const deleteBankForm = read(
  "src/app/dashboard/question-banks/delete-bank-form.tsx",
);
const assessmentsActions = read("src/app/dashboard/assessments/actions.ts");
const susulanPage = read("src/app/dashboard/tugas-susulan/page.tsx");
const databaseTypes = read("src/types/database.ts");
const migration0130 = read(
  "supabase/migrations/0130_lindungi_jawaban_post_tes.sql",
);
const migration0131 = read("supabase/migrations/0131_penjaga_hapus_bank_soal.sql");
const migration0024 = read("supabase/migrations/0024_delete_question_bank.sql");
const migration0132 = read(
  "supabase/migrations/0132_progres_susulan_rinci_guru.sql",
);
// Berkas seed post tes tinggal DI LUAR repo (ruang kerja pemilik),
// jadi di checkout bersih (misalnya CI GitHub) berkas ini tidak ada.
// Bacaan dibuat toleran: butir 10 dilewati bila berkasnya absen,
// bukan menggagalkan seluruh berkas tes.
const seedPath = path.join(
  root,
  "../../ppmk-barru-10-pertemuan/post-tes/seed-soal-post-tes-15.sql",
);
const seedPostTes = existsSync(seedPath)
  ? readFileSync(seedPath, "utf8")
  : null;
const seedTeks = seedPostTes ?? "";

function badanFungsi(
  sumber: string,
  nama: string,
  namaBerikut: string | null,
): string {
  const mulai = sumber.indexOf(`export async function ${nama}`);
  assert.notEqual(mulai, -1, `fungsi ${nama} harus ada`);
  if (namaBerikut === null) return sumber.slice(mulai);
  const akhir = sumber.indexOf(`export async function ${namaBerikut}`, mulai);
  assert.notEqual(akhir, -1, `fungsi ${namaBerikut} harus ada sesudah ${nama}`);
  return sumber.slice(mulai, akhir);
}

function sqlTanpaKomentar(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .toLowerCase();
}

describe("butir 1: penjaga hapus kelas", () => {
  const body = badanFungsi(classesActions, "deleteClass", null);

  test("server membaca confirm_name dan membandingkannya dengan nama kelas", () => {
    assert.ok(body.includes('formData.get("confirm_name")'));
    assert.ok(body.includes("confirmName !== classRow.name"));
    assert.ok(body.includes("error=name_mismatch"));
  });

  test("pemeriksaan nama berjalan sebelum penghapusan kelas", () => {
    const idxGuard = body.indexOf("error=name_mismatch");
    const idxDelete = body.indexOf('.from("classes")\n    .delete()');
    assert.ok(idxGuard > -1 && idxDelete > -1);
    assert.ok(idxGuard < idxDelete);
  });

  test("halaman menghitung isi kelas lewat RPC cakupan 0133", () => {
    // Sejak perbaikan lanjutan 18 Nov 2026, hitungan modal kelas
    // dibaca lewat RPC teacher_scope_counts_class (migrasi
    // 0133): SELECT langsung ke tabel pekerjaan siswa terbaca 0
    // secara diam-diam karena RLS tidak mengizinkan guru
    // membaca baris siswa. Rincian dikunci di berkas tes
    // hitungan-cakupan-hapus-rpc.test.ts.
    assert.ok(classesPage.includes('"teacher_scope_counts_class"'));
    for (const tabel of [
      "student_practice_answers",
      "student_catchup_progress",
      "student_game_results",
      "essay_submissions",
    ]) {
      assert.equal(classesPage.includes(`.from("${tabel}")`), false, tabel);
    }
    assert.ok(classesPage.includes("counts={deleteCounts}"));
    assert.ok(classesPage.includes("className={editingClass.name}"));
    assert.ok(classesPage.includes('case "name_mismatch"'));
  });

  test("modal mewajibkan mengetik nama kelas persis untuk mengaktifkan hapus", () => {
    assert.ok(deleteClassButton.includes('name="confirm_name"'));
    assert.ok(deleteClassButton.includes("typedName === className"));
    assert.ok(deleteClassButton.includes("disabled={submitting || !nameMatches}"));
    assert.ok(deleteClassButton.includes("jawaban latihan siswa"));
    assert.ok(deleteClassButton.includes("progres Tugas Susulan"));
  });
});

describe("butir 2: modal hapus siswa mengungkapkan cakupan", () => {
  test("halaman menghitung enam cakupan siswa lewat RPC 0133", () => {
    // Sama seperti kelas: hitungan kini lewat RPC
    // teacher_scope_counts_student (migrasi 0133), bukan SELECT
    // langsung yang terbaca 0 karena RLS.
    assert.ok(studentsPage.includes('"teacher_scope_counts_student"'));
    for (const kolom of [
      "practice_answers",
      "catchup_progress",
      "attendance",
      "solo_results",
      "post_test_answers",
      "essay_submissions",
    ]) {
      assert.ok(studentsPage.includes(kolom), kolom);
    }
    assert.ok(
      studentsPage.includes("Data yang ikut terhapus bersama siswa ini"),
    );
    assert.ok(studentsPage.includes("jawaban post tes"));
  });

  test("komponen tombol menampilkan scopeText di modal", () => {
    assert.ok(deleteStudentButton.includes("scopeText"));
    assert.ok(deleteStudentButton.includes("{scopeText}"));
  });

  test("teks konfirmasi kamus menyebut data yang ikut terhapus", () => {
    assert.ok(
      idDict.class_detail.delete_student_confirm.includes("ikut terhapus"),
    );
    assert.equal(
      idDict.class_detail.delete_student_confirm.includes("—"),
      false,
    );
  });
});

describe("butir 3: penjaga hapus tugas esai", () => {
  const body = badanFungsi(essayActions, "deleteEssay", null);

  test("menghitung essay_submissions sebelum menghapus tugas", () => {
    const idxCount = body.indexOf('.from("essay_submissions")');
    const idxDelete = body.indexOf('.from("essay_assignments")');
    assert.ok(idxCount > -1 && idxDelete > -1);
    assert.ok(idxCount < idxDelete);
    assert.ok(body.includes('.eq("assignment_id", essayId)'));
  });

  test("membatalkan dengan kode has_submissions dan fail-closed", () => {
    assert.ok(body.includes("essay_error=has_submissions"));
    assert.ok(body.includes("essay_error=delete_failed"));
    assert.ok(body.includes("(submissionCount ?? 0) > 0"));
  });

  test("halaman kelas menerjemahkan kode menjadi pesan jelas", () => {
    assert.ok(classDetailPage.includes('essay_error === "has_submissions"'));
    assert.ok(
      classDetailPage.includes(
        "tidak bisa dihapus karena sudah ada esai siswa yang terkumpul",
      ),
    );
  });
});

describe("butir 4: pemberitahuan arsip pada hapus permainan", () => {
  test("modal hapus permainan menampilkan hitungan arsip", () => {
    assert.ok(deleteGameButton.includes("archiveSessionCount"));
    assert.ok(deleteGameButton.includes("archiveSubmissionCount"));
    assert.ok(deleteGameButton.includes("Sesi arsip yang ikut terhapus:"));
    assert.ok(deleteGameButton.includes("Jawaban ruangan yang ikut terhapus:"));
  });

  test("halaman menghitung arsip per permainan lewat RPC 0133", () => {
    assert.ok(gamesPage.includes('"teacher_scope_counts_game"'));
    assert.equal(gamesPage.includes('.from("room_sessions")'), false);
    assert.ok(gamesPage.includes("archiveSessionCount={"));
    assert.ok(gamesPage.includes("archiveSubmissionCount={"));
  });

  test("kartu meneruskan hitungan ke tombol hapus", () => {
    assert.ok(gameCardActions.includes("archiveSessionCount={archiveSessionCount}"));
    assert.ok(
      gameCardActions.includes("archiveSubmissionCount={archiveSubmissionCount}"),
    );
  });

  test("penjaga jawaban latihan deleteGame tidak berubah", () => {
    const actions = read("src/app/dashboard/games/actions.ts");
    assert.ok(actions.includes("error=has_practice_answers"));
  });
});

describe("butir 5: peringatan hapus materi bahan Baca", () => {
  test("modal memakai pemeta materi yang sama seperti sisi siswa", () => {
    assert.ok(
      materialList.includes(
        'import { darsDariJudulMateri } from "@/modules/tugas-susulan/materi"',
      ),
    );
    assert.ok(materialList.includes("darsDariJudulMateri(pendingDelete.title)"));
  });

  test("teks peringatan menyebut langkah wajib Baca dars itu", () => {
    assert.ok(materialList.includes("bahan Langkah Baca Tugas"));
    assert.ok(materialList.includes("tidak akan bisa"));
    assert.ok(materialList.includes("menyelesaikan langkah wajib itu"));
  });
});

describe("butir 6: migrasi 0130 FK jawaban post tes menjadi RESTRICT", () => {
  const sqlBody = sqlTanpaKomentar(migration0130);

  test("constraint lama dijatuhkan lewat katalog sistem", () => {
    assert.ok(sqlBody.includes("pg_constraint"));
    assert.ok(sqlBody.includes("con.contype = 'f'"));
    assert.ok(sqlBody.includes("att.attname = 'question_id'"));
    assert.ok(sqlBody.includes("rel.relname = 'post_test_answers'"));
    assert.ok(sqlBody.includes("drop constraint"));
  });

  test("constraint baru memakai nama bawaan 0126 dan restrict", () => {
    assert.ok(
      sqlBody.includes("add constraint post_test_answers_question_id_fkey"),
    );
    assert.ok(sqlBody.includes("references public.post_test_questions (id)"));
    assert.ok(sqlBody.includes("on delete restrict"));
    assert.equal(sqlBody.includes("on delete cascade"), false);
  });

  test("hanya tabel post_test_answers yang diubah", () => {
    const alterTargets = [
      ...sqlBody.matchAll(/alter table public\.(\w+)/g),
    ].map((m) => m[1]);
    assert.ok(alterTargets.length >= 1);
    for (const target of alterTargets) {
      assert.equal(target, "post_test_answers");
    }
  });
});

describe("butir 7: migrasi 0131 penjaga RPC delete_question_bank", () => {
  const sqlBody = sqlTanpaKomentar(migration0131);

  test("penjaga jawaban latihan ada dan berjalan sebelum langkah hapus", () => {
    assert.ok(sqlBody.includes("student_practice_answers"));
    assert.ok(sqlBody.includes("bank_has_practice_answers"));
    const idxGuard = sqlBody.indexOf("bank_has_practice_answers");
    const idxDelete = sqlBody.indexOf("delete from public.submissions");
    assert.ok(idxGuard > -1 && idxDelete > -1);
    assert.ok(idxGuard < idxDelete);
  });

  test("pesan penolakan berbahasa Indonesia dan menyebut pekerjaan siswa", () => {
    assert.ok(
      migration0131.includes(
        "Bank soal ini tidak bisa dihapus karena sudah ada",
      ),
    );
    assert.ok(migration0131.includes("jawaban latihan siswa"));
  });

  test("seluruh langkah penghapusan 0024 dipertahankan", () => {
    const langkah = [
      "delete from public.submissions",
      "delete from public.game_questions",
      "delete from public.question_media",
      "delete from public.question_options",
      "delete from public.questions where question_bank_id = p_bank_id",
      "delete from public.question_banks where id = p_bank_id",
    ];
    for (const s of langkah) {
      assert.ok(sqlTanpaKomentar(migration0024).includes(s), `0024: ${s}`);
      assert.ok(sqlBody.includes(s), `0131: ${s}`);
    }
    assert.ok(sqlBody.includes("raise exception 'bank_not_found'"));
    assert.ok(sqlBody.includes("raise exception 'forbidden'"));
    assert.ok(
      sqlBody.includes(
        "grant execute on function public.delete_question_bank(uuid) to authenticated",
      ),
    );
  });

  test("kepala berkas memuat ringkasan selisih terhadap 0024", () => {
    assert.ok(migration0131.includes("SELISIH TERHADAP 0024"));
  });
});

describe("butir 8: hapus bank, pesan jelas dan modal berangka", () => {
  const body = badanFungsi(
    qbActions,
    "deleteQuestionBank",
    "importQuestionBankRows",
  );

  test("galat RPC diterjemahkan menjadi kode pesan yang jelas", () => {
    assert.ok(body.includes("bank_has_practice_answers"));
    assert.ok(body.includes("error=has_practice_answers"));
    assert.ok(body.includes("error=bank_fk_blocked"));
    assert.ok(body.includes("violates foreign key constraint"));
  });

  test("halaman punya pesan Bahasa Indonesia untuk kedua kode", () => {
    assert.ok(qbPage.includes('case "has_practice_answers"'));
    assert.ok(qbPage.includes('case "bank_fk_blocked"'));
    assert.ok(
      qbPage.includes(
        "tidak bisa dihapus karena sudah ada jawaban latihan siswa",
      ),
    );
  });

  test("halaman menghitung submissions dan jawaban latihan per bank lewat RPC 0133", () => {
    assert.ok(qbPage.includes('"teacher_scope_counts_bank"'));
    assert.ok(qbPage.includes("bankScopeCounts"));
    assert.ok(qbPage.includes("submissionCount={bankScopeCounts.get(bank.id)?.submissions}"));
    assert.ok(qbPage.includes("practiceAnswerCount={bankScopeCounts.get(bank.id)?.practiceAnswers}"));
  });

  test("modal menampilkan kedua hitungan jawaban", () => {
    assert.ok(deleteBankForm.includes("submissionCount"));
    assert.ok(deleteBankForm.includes("practiceAnswerCount"));
    assert.ok(deleteBankForm.includes("Jawaban ruangan yang ikut terhapus:"));
    assert.ok(deleteBankForm.includes("Jawaban latihan siswa:"));
    assert.ok(deleteBankForm.includes("akan ditolak"));
  });
});

describe("butir 9: memunculkan progres siswa yang sedang berproses", () => {
  test("migrasi 0132 membuat RPC rincian dengan pola keamanan guru", () => {
    const sqlBody = sqlTanpaKomentar(migration0132);
    assert.ok(sqlBody.includes("teacher_catchup_progress_detail"));
    assert.ok(sqlBody.includes("raise exception 'auth_required'"));
    assert.ok(sqlBody.includes("raise exception 'class_not_owned'"));
    for (const kolom of [
      "baca_done",
      "kosakata_done",
      "qawaid_done",
      "answered_count",
      "correct_count",
    ]) {
      assert.ok(sqlBody.includes(kolom), kolom);
    }
    assert.ok(
      sqlBody.includes(
        "grant execute on function public.teacher_catchup_progress_detail(uuid)",
      ),
    );
  });

  test("tipe RPC terdaftar di database.ts", () => {
    assert.ok(databaseTypes.includes("teacher_catchup_progress_detail"));
  });

  test("halaman guru menampilkan baris Sedang proses per siswa", () => {
    assert.ok(susulanPage.includes('"teacher_catchup_progress_detail"'));
    assert.ok(susulanPage.includes("Sedang proses:"));
    assert.ok(susulanPage.includes("segmenProses"));
    assert.ok(susulanPage.includes("terjawab"));
  });
});

describe(
  "butir 10: seed post tes tanpa hapus semua",
  { skip: seedPostTes === null },
  () => {
  const kode = seedTeks
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .toLowerCase();

  test("tidak ada perintah hapus apa pun di badan seed", () => {
    assert.equal(kode.includes("delete from"), false);
    assert.equal(kode.includes("truncate"), false);
  });

  test("15 soal ditulis sebagai upsert per nomor urut", () => {
    // Dihitung dari badan kode (tanpa komentar), karena kepala
    // berkas juga menyebut pola upsert di dalam penjelasannya.
    assert.equal(
      kode.split("insert into public.post_test_questions").length - 1,
      15,
    );
    assert.equal(kode.split("on conflict (urutan) do update").length - 1, 15);
  });

  test("isi soal pertama dan terakhir sama seperti versi final", () => {
    assert.ok(seedTeks.includes("Apa jawaban dari ''Assalamu alaikum''?"));
    assert.ok(
      seedTeks.includes("وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ"),
    );
    assert.ok(seedTeks.includes("Madza ta''kulu fil futhur?"));
    assert.ok(seedTeks.includes("آكُلُ الْخُبْزَ وَالْبَيْضَ"));
  });

  test("kepala seed memperingatkan penolakan basis data", () => {
    assert.ok(seedTeks.includes("ON DELETE RESTRICT"));
    assert.ok(seedTeks.includes("DITOLAK basis data"));
  });
  },
);

describe("butir 12: penjaga asesmen", () => {
  const deleteBody = badanFungsi(
    assessmentsActions,
    "deleteAssessment",
    "togglePublish",
  );
  const importBody = badanFungsi(
    assessmentsActions,
    "importAssessment",
    "generateAssessmentToken",
  );

  test("deleteAssessment menghitung attempt sebelum menghapus", () => {
    const idxCount = deleteBody.indexOf('.from("assessment_attempts")');
    const idxDelete = deleteBody.indexOf('.from("assessments")\n    .delete()');
    assert.ok(idxCount > -1 && idxDelete > -1);
    assert.ok(idxCount < idxDelete);
    assert.ok(deleteBody.includes("(attemptCount ?? 0) > 0"));
    assert.ok(deleteBody.includes("attemptCountError"));
    assert.ok(
      deleteBody.includes("tidak bisa dihapus karena sudah ada"),
    );
  });

  test("impor ulang menghitung jawaban soal lama sebelum menghapus soal", () => {
    const idxCount = importBody.indexOf('.from("assessment_answers")');
    const idxDelete = importBody.indexOf(
      '.from("assessment_questions")\n    .delete()',
    );
    assert.ok(idxCount > -1 && idxDelete > -1);
    assert.ok(idxCount < idxDelete);
    assert.ok(importBody.includes("(answerCount ?? 0) > 0"));
    assert.ok(importBody.includes("answerCountError"));
    assert.ok(importBody.includes("Impor ulang dibatalkan: soal lama"));
  });
});

describe("teks baru tanpa em dash", () => {
  test("potongan pesan penjaga tidak memakai em dash", () => {
    const potongan: Array<[string, string]> = [
      ["deleteClass", badanFungsi(classesActions, "deleteClass", null)],
      ["deleteEssay", badanFungsi(essayActions, "deleteEssay", null)],
      [
        "deleteAssessment",
        badanFungsi(assessmentsActions, "deleteAssessment", "togglePublish"),
      ],
      [
        "importAssessment",
        badanFungsi(
          assessmentsActions,
          "importAssessment",
          "generateAssessmentToken",
        ),
      ],
      ["deleteClassButton", deleteClassButton],
      ["deleteBankForm", deleteBankForm],
    ];
    for (const [nama, teks] of potongan) {
      assert.equal(teks.includes("—"), false, nama);
    }
  });
});
