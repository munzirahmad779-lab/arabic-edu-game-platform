import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Paket perbaikan kejujuran simpan sisi siswa (audit 18 Nov 2026,
// perintah pemilik "perbaiki semuanya"). Enam perbaikan yang
// semuanya berakar pada pola yang sama: kegagalan simpan di sisi
// siswa ditelan diam-diam sehingga layar berbohong seolah pekerjaan
// sudah tersimpan. Tes-tes ini mengunci perilaku baru pada sumber.

function baca(rel: string): string {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

/* ---------------------------------------------------------------
 * Butir 1: player asesmen tidak lagi menelan galat simpan.
 * ------------------------------------------------------------- */

const assessmentPlayer = baca("src/app/assessment/[attemptToken]/player.tsx");

test("asesmen: pola diam lama sudah hilang dari jalur simpan jawaban", () => {
  assert.ok(
    !assessmentPlayer.includes("diamkan seperti perilaku lama"),
    "komentar pola diam lama tidak boleh ada lagi",
  );
  // Fungsi pengiriman jawaban: catch-nya menandai gagal, bukan diam.
  // (Catch diam di fungsi lain, misalnya muat ulang payload section,
  // di luar cakupan butir ini.)
  const kirimBody = assessmentPlayer.slice(
    assessmentPlayer.indexOf("async function kirimJawabanKeServer"),
    assessmentPlayer.indexOf("function cobaLagiYangGagal"),
  );
  assert.ok(!kirimBody.includes("// silent"));
  assert.ok(
    kirimBody.includes("pendingAnswersRef.current[questionId] = answer"),
  );
  assert.ok(kirimBody.includes('"failed"'));
});

test("asesmen: status simpan per soal ada dan ditandai belum tersimpan", () => {
  assert.match(assessmentPlayer, /saveStatusMap/);
  assert.match(assessmentPlayer, /"saving" \| "saved" \| "failed"/);
  assert.ok(assessmentPlayer.includes("BELUM tersimpan"));
  assert.ok(assessmentPlayer.includes("Jawaban tersimpan"));
});

test("asesmen: kegagalan masuk antrean coba lagi otomatis dan manual", () => {
  assert.match(assessmentPlayer, /pendingAnswersRef/);
  assert.match(assessmentPlayer, /function cobaLagiYangGagal/);
  // saveAnswer memicu coba lagi untuk jawaban gagal sebelumnya.
  const saveAnswerBody = assessmentPlayer.slice(
    assessmentPlayer.indexOf("async function saveAnswer"),
  );
  assert.ok(saveAnswerBody.includes("cobaLagiYangGagal(questionId)"));
  // Tombol coba lagi tampil untuk siswa.
  assert.ok(assessmentPlayer.includes("Coba Lagi"));
  assert.ok(assessmentPlayer.includes("Coba Lagi Semua"));
  // Navigasi soal menandai soal yang gagal dengan warna merah.
  assert.ok(assessmentPlayer.includes("bg-red-600"));
  assert.ok(assessmentPlayer.includes("failedSaveCount"));
});

/* ---------------------------------------------------------------
 * Butir 2: hasil game solo bersuara di kelima game.
 * ------------------------------------------------------------- */

const submitStatus = baca("src/modules/game-results/submit-status.tsx");

test("game solo: modul status kirim memuat teks wajib", () => {
  assert.match(submitStatus, /useStudentResultSubmit/);
  assert.match(submitStatus, /StudentResultNote/);
  assert.ok(submitStatus.includes("Hasilmu sudah tercatat"));
  assert.ok(
    submitStatus.includes("Hasilmu belum tercatat. Periksa koneksimu."),
  );
  assert.ok(submitStatus.includes("Kirim Ulang Hasil"));
  // Status tercatat hanya dari nilai kembali helper boolean.
  assert.match(submitStatus, /await submitStudentGameResult\(/);
  assert.ok(submitStatus.includes('ok ? "tercatat" : "gagal"'));
});

const gameFiles: Array<[string, string]> = [
  ["space-war", "src/modules/space-war/modul/Game.tsx"],
  ["ketapel-buah", "src/modules/ketapel-buah/modul/Game.tsx"],
  ["ketapel-burung", "src/modules/ketapel-burung/modul/Game.tsx"],
  ["jejak-angka", "src/modules/jejak-angka/modul/Game.tsx"],
  ["ludo-angka", "src/modules/ludo-angka/modul/Game.tsx"],
];

for (const [slug, rel] of gameFiles) {
  test(`game solo ${slug}: memakai pengait bersuara, bukan void diam`, () => {
    const src = baca(rel);
    assert.match(src, /useStudentResultSubmit/);
    assert.match(src, /StudentResultNote/);
    assert.ok(
      src.includes(`useStudentResultSubmit("${slug}")`),
      "slug pengait harus cocok dengan game",
    );
    assert.ok(
      !src.includes("void submitStudentGameResult"),
      "panggilan void lama tidak boleh tersisa",
    );
    assert.ok(
      !src.includes('from "@/modules/game-results/submit"'),
      "impor helper lama tidak boleh tersisa",
    );
  });
}

/* ---------------------------------------------------------------
 * Butir 3: reset latihan memeriksa galat RPC.
 * ------------------------------------------------------------- */

const practicePlayer = baca(
  "src/app/student/practice/[gameId]/practice-player.tsx",
);

test("reset latihan: nilai error RPC diperiksa sebelum mengosongkan", () => {
  assert.match(
    practicePlayer,
    /const \{ error \} = await supabase\.rpc\("student_reset_practice"/,
  );
  assert.ok(!practicePlayer.includes("// ignore"));
  assert.ok(
    practicePlayer.includes(
      "Gagal mengulang latihan. Jawabanmu belum berubah.",
    ),
  );
  assert.match(practicePlayer, /resetError/);
});

test("reset latihan: modal menyebut progres Tugas Susulan ikut terhapus", () => {
  assert.ok(
    practicePlayer.includes(
      "progres Tugas Susulan untuk dars permainan",
    ),
  );
  assert.ok(practicePlayer.includes("ikut terhapus"));
});

/* ---------------------------------------------------------------
 * Butir 4: pesan gagal langkah susulan dibedakan sebabnya.
 * ------------------------------------------------------------- */

const tugasActions = baca("src/app/student/tugas-susulan/actions.ts");
const tugasCard = baca("src/app/student/tugas-susulan/tugas-card.tsx");

test("langkah susulan: aksi meneruskan penanda penolakan waktu", () => {
  assert.match(tugasActions, /ditolakWaktu/);
  assert.ok(tugasActions.includes("ditolakWaktu: data === false"));
});

test("langkah susulan: pesan 7 menit hanya untuk penolakan waktu", () => {
  assert.ok(tugasCard.includes("res.ditolakWaktu"));
  assert.ok(
    tugasCard.includes("waktu minimal 7 menit belum tercapai"),
  );
  assert.ok(
    tugasCard.includes("Belum tersimpan. Periksa koneksimu lalu coba lagi."),
  );
});

/* ---------------------------------------------------------------
 * Butir 5: klien post tes menyimpan hasil unggahan untuk kirim
 * ulang tanpa unggah ulang.
 * ------------------------------------------------------------- */

const postTesClient = baca("src/app/student/post-tes/post-tes-client.tsx");

test("post tes: hasil unggahan disimpan di keadaan komponen", () => {
  assert.match(postTesClient, /const \[uploaded, setUploaded\]/);
  assert.ok(postTesClient.includes("setUploaded({ fileId, link })"));
});

test("post tes: kirim ulang melewati unggahan bila file_id sudah ada", () => {
  const kirimIdx = postTesClient.indexOf("async function kirim()");
  const kirimBody = postTesClient.slice(kirimIdx);
  assert.ok(kirimBody.includes("uploaded?.fileId"));
  assert.ok(kirimBody.includes("if (!fileId || !link)"));
  // Rekam ulang adalah satu-satunya jalan membuang unggahan lama.
  const rekamUlangBody = postTesClient.slice(
    postTesClient.indexOf("function rekamUlang()"),
    kirimIdx,
  );
  assert.ok(rekamUlangBody.includes("setUploaded(null)"));
});

/* ---------------------------------------------------------------
 * Butir 6: layar hasil esai tidak menampilkan skor 0 palsu.
 * ------------------------------------------------------------- */

const essayPlayer = baca("src/app/student/essay/[essayId]/essay-player.tsx");

test("esai: teks tegas terkumpul tampil untuk keadaan belum dinilai", () => {
  assert.ok(
    essayPlayer.includes(
      "Esaimu sudah terkumpul. Penilaian menyusul oleh guru.",
    ),
  );
  assert.match(essayPlayer, /belumDinilai/);
  assert.ok(essayPlayer.includes("setBelumDinilai(true)"));
});

test("esai: hasil palsu skor 0 sudah tidak dibuat lagi", () => {
  assert.ok(
    !essayPlayer.includes("essay_player_not_graded"),
    "umpan balik palsu skor 0 tidak boleh dibuat lagi",
  );
  // Keadaan awal dari server: terkumpul tanpa nilai berarti belum
  // dinilai, bukan skor 0.
  assert.ok(
    essayPlayer.includes("alreadySubmitted && essay.my_score === null"),
  );
});
