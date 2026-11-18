/**
 * Regression: fitur Post Tes VN (ujian akhir, jawaban rekaman suara).
 *
 * Aturan yang dijaga test ini:
 * 1. Migrasi 0126 menyiapkan tabel soal, jawaban, dan pengaturan,
 *    dengan RLS aktif dan satu jawaban per siswa per soal.
 * 2. RPC simpan jawaban siswa MENOLAK saat post tes tertutup
 *    (pengecualian post_test_closed diperiksa sebelum insert).
 * 3. RPC baca sisi siswa tidak pernah mengembalikan jawaban_model.
 * 4. Rute unggah /api/student/post-test/upload menolak tanpa sesi
 *    siswa (401) dan membalas jelas bila env jembatan unggah belum
 *    terpasang (UPLOAD_NOT_CONFIGURED, 503).
 * 5. Halaman siswa menampilkan keadaan tertutup dengan teks
 *    pemberitahuan resmi, dan kartu masuk ada di Latihan Mandiri.
 * 6. Fungsi unggah mengirim JSON { token, filename, mime, data }
 *    ke Web App Apps Script dan memetakan balasan { ok, id, url }
 *    menjadi { fileId, link }.
 * 7. Fungsi unggah TAHAN kegagalan sesaat: fetch yang terlempar,
 *    status HTTP galat, dan balasan ok:false dicoba ulang sampai
 *    3 percobaan dengan jeda bertingkat; ok:true langsung berhenti.
 *    UPLOAD_NOT_CONFIGURED tidak dicoba ulang dan fetch tidak
 *    dipanggil sama sekali.
 * 8. Klien mencoba ulang fetch unggah satu kali secara otomatis
 *    bila jaringan putus, dan rekaman TIDAK hilang saat kirim
 *    gagal: fase kembali ke "recorded" dan blob hanya dikosongkan
 *    oleh tombol Rekam Ulang.
 *
 * Test membaca berkas sumber seperti pola test tugas-susulan, plus
 * unit test murni untuk pembersih nama berkas dan fungsi unggah
 * dengan fetch yang dimock.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  sanitizeDriveFileName,
  uploadAudioToDrive,
  uploadConfigured,
} from "../../src/lib/google-drive";

const root = process.cwd();
const migration = readFileSync(
  path.join(root, "supabase/migrations/0126_post_tes_vn.sql"),
  "utf8",
);
const uploadRoute = readFileSync(
  path.join(root, "src/app/api/student/post-test/upload/route.ts"),
  "utf8",
);
const studentPage = readFileSync(
  path.join(root, "src/app/student/post-tes/page.tsx"),
  "utf8",
);
const studentClient = readFileSync(
  path.join(root, "src/app/student/post-tes/post-tes-client.tsx"),
  "utf8",
);
const practicePage = readFileSync(
  path.join(root, "src/app/student/practice/page.tsx"),
  "utf8",
);
const teacherPage = readFileSync(
  path.join(root, "src/app/dashboard/post-tes/page.tsx"),
  "utf8",
);

// Badan SQL tanpa komentar, supaya kata yang hanya disebut di catatan
// kepala berkas tidak ikut terhitung sebagai logika.
const sqlBody = migration
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

function fungsiSql(nama: string): string {
  const mulai = sqlBody.indexOf(`create or replace function public.${nama}`);
  assert.notEqual(mulai, -1, `fungsi ${nama} harus ada di migrasi 0126`);
  const akhir = sqlBody.indexOf("grant execute", mulai);
  assert.notEqual(akhir, -1, `grant untuk ${nama} harus ada`);
  return sqlBody.slice(mulai, akhir);
}

describe("migrasi 0126: tabel post tes", () => {
  test("tiga tabel dibuat dan RLS aktif di semuanya", () => {
    for (const tabel of [
      "post_test_questions",
      "post_test_answers",
      "post_test_settings",
    ]) {
      assert.ok(
        sqlBody.includes(`create table public.${tabel}`),
        `tabel ${tabel} harus dibuat`,
      );
      assert.ok(
        sqlBody.includes(
          `alter table public.${tabel} enable row level security`,
        ),
        `RLS harus aktif pada ${tabel}`,
      );
    }
  });

  test("satu jawaban per siswa per soal dan kolom penilaian tersedia", () => {
    assert.ok(sqlBody.includes("unique (student_id, question_id)"));
    for (const kolom of ["skor numeric", "transkrip text", "catatan text", "graded_at timestamptz"]) {
      assert.ok(sqlBody.includes(kolom), `kolom ${kolom} harus ada`);
    }
    assert.ok(sqlBody.includes("drive_file_id text"));
    assert.ok(sqlBody.includes("drive_link text"));
  });

  test("pengaturan mulai dari tertutup", () => {
    assert.ok(sqlBody.includes("is_open boolean not null default false"));
    assert.ok(sqlBody.includes("values (1, false)"));
  });
});

describe("migrasi 0126: RPC siswa", () => {
  test("kedua RPC siswa memverifikasi sesi lewat verify_student_session", () => {
    for (const nama of ["student_get_post_test", "student_save_post_test_answer"]) {
      assert.ok(
        fungsiSql(nama).includes("verify_student_session"),
        `${nama} harus memakai verify_student_session`,
      );
    }
  });

  test("simpan jawaban menolak saat tertutup, sebelum insert apa pun", () => {
    const simpan = fungsiSql("student_save_post_test_answer");
    const idxTolak = simpan.indexOf("post_test_closed");
    const idxInsert = simpan.indexOf("insert into public.post_test_answers");
    assert.notEqual(idxTolak, -1, "penolakan post_test_closed harus ada");
    assert.notEqual(idxInsert, -1, "insert jawaban harus ada");
    assert.ok(
      idxTolak < idxInsert,
      "pemeriksaan tertutup harus mendahului insert",
    );
    assert.ok(simpan.includes("if not v_open then"));
    assert.ok(simpan.includes("on conflict (student_id, question_id)"));
  });

  test("baca sisi siswa tidak pernah mengembalikan jawaban_model", () => {
    const baca = fungsiSql("student_get_post_test");
    assert.equal(baca.includes("jawaban_model"), false);
    assert.ok(baca.includes("'pertanyaan', q.pertanyaan"));
    assert.ok(baca.includes("'is_open', v_open"));
  });

  test("RPC siswa diberi ke anon dan authenticated, RPC guru hanya authenticated", () => {
    assert.ok(
      sqlBody.includes(
        "grant execute on function public.student_get_post_test(text)\n  to anon, authenticated;",
      ),
    );
    assert.ok(
      sqlBody.includes(
        "grant execute on function public.teacher_post_test_overview(uuid)\n  to authenticated;",
      ),
    );
    assert.ok(
      sqlBody.includes(
        "grant execute on function public.teacher_set_post_test_grade(uuid, numeric, text, text)\n  to authenticated;",
      ),
    );
  });
});

describe("migrasi 0126: RPC guru", () => {
  test("RPC guru menolak tanpa login dan memeriksa kepemilikan kelas", () => {
    const overview = fungsiSql("teacher_post_test_overview");
    assert.ok(overview.includes("auth.uid() is null"));
    assert.ok(overview.includes("CLASS_NOT_OWNED"));
    const rincian = fungsiSql("teacher_post_test_student");
    assert.ok(rincian.includes("STUDENT_NOT_OWNED"));
    assert.ok(rincian.includes("q.jawaban_model"));
  });

  test("saklar buka tutup menulis ke post_test_settings", () => {
    const saklar = fungsiSql("teacher_set_post_test_open");
    assert.ok(saklar.includes("insert into public.post_test_settings"));
    assert.ok(saklar.includes("auth.uid() is null"));
  });

  test("penilaian memeriksa rentang skor 0 sampai 100", () => {
    const nilai = fungsiSql("teacher_set_post_test_grade");
    assert.ok(nilai.includes("p_skor < 0 or p_skor > 100"));
    assert.ok(nilai.includes("ANSWER_NOT_OWNED"));
  });
});

describe("rute unggah suara", () => {
  test("menolak tanpa sesi siswa dengan 401", () => {
    assert.ok(uploadRoute.includes("getStudentSession"));
    assert.ok(uploadRoute.includes('status: 401'));
    assert.ok(uploadRoute.includes('"UNAUTHORIZED"'));
  });

  test("membalas jelas bila env jembatan unggah belum terpasang", () => {
    assert.ok(uploadRoute.includes("uploadConfigured()"));
    assert.ok(uploadRoute.includes("UPLOAD_NOT_CONFIGURED"));
    assert.ok(uploadRoute.includes("status: 503"));
  });

  test("mengunggah lewat pustaka Drive dan memakai nama siswa untuk nama berkas", () => {
    assert.ok(uploadRoute.includes("uploadAudioToDrive"));
    assert.ok(uploadRoute.includes("session.name"));
    assert.ok(uploadRoute.includes("form.get(\"urutan\")"));
  });
});

describe("halaman siswa dan guru", () => {
  test("halaman siswa menampilkan pemberitahuan keadaan tertutup", () => {
    assert.ok(
      studentPage.includes(
        "Post tes belum dibuka. Tunggu pengumuman guru.",
      ),
    );
    assert.ok(studentPage.includes("student_get_post_test"));
  });

  test("kartu masuk Post Tes ada di Latihan Mandiri", () => {
    assert.ok(practicePage.includes('href="/student/post-tes"'));
    assert.ok(practicePage.includes("Post Tes: Ujian Akhir"));
  });

  test("halaman guru memakai RPC ringkasan dan saklar", () => {
    assert.ok(teacherPage.includes("teacher_post_test_overview"));
    assert.ok(teacherPage.includes("teacher_post_test_status"));
    assert.ok(teacherPage.includes("PostTesToggle"));
  });
});

describe("pustaka google-drive", () => {
  test("sanitizeDriveFileName membuang pemisah jalur dan karakter kendali", () => {
    assert.equal(sanitizeDriveFileName("Anya/S\\al 12.webm"), "Anya-S-al 12.webm");
    assert.equal(sanitizeDriveFileName("  nama bersih.webm  "), "nama bersih.webm");
  });

  function denganEnvUpload(
    nilai: { url?: string; secret?: string },
    fn: () => void | Promise<void>,
  ): Promise<void> {
    const lamaUrl = process.env.POST_TEST_UPLOAD_URL;
    const lamaSecret = process.env.POST_TEST_UPLOAD_SECRET;
    if (nilai.url === undefined) delete process.env.POST_TEST_UPLOAD_URL;
    else process.env.POST_TEST_UPLOAD_URL = nilai.url;
    if (nilai.secret === undefined) delete process.env.POST_TEST_UPLOAD_SECRET;
    else process.env.POST_TEST_UPLOAD_SECRET = nilai.secret;
    return Promise.resolve()
      .then(fn)
      .finally(() => {
        if (lamaUrl === undefined) delete process.env.POST_TEST_UPLOAD_URL;
        else process.env.POST_TEST_UPLOAD_URL = lamaUrl;
        if (lamaSecret === undefined) delete process.env.POST_TEST_UPLOAD_SECRET;
        else process.env.POST_TEST_UPLOAD_SECRET = lamaSecret;
      });
  }

  test("uploadConfigured false bila env belum terpasang", async () => {
    await denganEnvUpload({}, () => {
      assert.equal(uploadConfigured(), false);
    });
    await denganEnvUpload({ url: "https://script.google.com/macros/s/uji/exec" }, () => {
      assert.equal(uploadConfigured(), false);
    });
  });

  test("uploadConfigured true bila kedua env terpasang", async () => {
    await denganEnvUpload(
      { url: "https://script.google.com/macros/s/uji/exec", secret: "token-uji" },
      () => {
        assert.equal(uploadConfigured(), true);
      },
    );
  });

  test("uploadAudioToDrive menolak jelas bila env belum terpasang", async () => {
    await denganEnvUpload({}, async () => {
      await assert.rejects(
        uploadAudioToDrive({
          fileName: "Anya - Soal 1.webm",
          mimeType: "audio/webm",
          bytes: new Uint8Array([1, 2, 3]),
        }),
        /UPLOAD_NOT_CONFIGURED/,
      );
    });
  });

  test("uploadAudioToDrive mengirim JSON token dan base64 lalu memetakan id dan url", async () => {
    const fetchAsli = globalThis.fetch;
    let urlTerpanggil = "";
    let initTerpanggil: RequestInit | undefined;
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      urlTerpanggil = String(input);
      initTerpanggil = init;
      return new Response(
        JSON.stringify({
          ok: true,
          id: "fileId123",
          url: "https://drive.google.com/file/d/fileId123/view?usp=drivesdk",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      await denganEnvUpload(
        { url: "https://script.google.com/macros/s/uji/exec", secret: "token-uji" },
        async () => {
          const hasil = await uploadAudioToDrive({
            fileName: "Anya - Soal 1.webm",
            mimeType: "audio/webm",
            bytes: new Uint8Array([1, 2, 3]),
          });
          assert.deepEqual(hasil, {
            fileId: "fileId123",
            link: "https://drive.google.com/file/d/fileId123/view?usp=drivesdk",
          });
        },
      );
    } finally {
      globalThis.fetch = fetchAsli;
    }
    assert.equal(urlTerpanggil, "https://script.google.com/macros/s/uji/exec");
    assert.equal(initTerpanggil?.method, "POST");
    const headers = (initTerpanggil?.headers ?? {}) as Record<string, string>;
    assert.equal(headers["Content-Type"], "application/json");
    const body = JSON.parse(String(initTerpanggil?.body)) as Record<string, string>;
    assert.equal(body.token, "token-uji");
    assert.equal(body.filename, "Anya - Soal 1.webm");
    assert.equal(body.mime, "audio/webm");
    assert.equal(body.data, "AQID");
  });

  test("uploadAudioToDrive menolak bila jembatan membalas ok false, sesudah 3 percobaan", async () => {
    const fetchAsli = globalThis.fetch;
    let panggilan = 0;
    globalThis.fetch = (async () => {
      panggilan++;
      return new Response(JSON.stringify({ ok: false, error: "token_salah" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    try {
      await denganEnvUpload(
        { url: "https://script.google.com/macros/s/uji/exec", secret: "token-uji" },
        async () => {
          await assert.rejects(
            uploadAudioToDrive({
              fileName: "Anya - Soal 1.webm",
              mimeType: "audio/webm",
              bytes: new Uint8Array([1]),
            }),
            /UPLOAD_REJECTED: token_salah/,
          );
        },
      );
    } finally {
      globalThis.fetch = fetchAsli;
    }
    assert.equal(panggilan, 3, "ok:false harus dicoba ulang sampai 3 percobaan");
  });

  test("uploadAudioToDrive berhasil pada percobaan kedua sesudah fetch pertama terlempar", async () => {
    const fetchAsli = globalThis.fetch;
    let panggilan = 0;
    globalThis.fetch = (async () => {
      panggilan++;
      if (panggilan === 1) {
        throw new TypeError("fetch failed");
      }
      return new Response(
        JSON.stringify({
          ok: true,
          id: "fileIdRetry",
          url: "https://drive.google.com/file/d/fileIdRetry/view?usp=drivesdk",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      await denganEnvUpload(
        { url: "https://script.google.com/macros/s/uji/exec", secret: "token-uji" },
        async () => {
          const hasil = await uploadAudioToDrive({
            fileName: "Anya - Soal 1.webm",
            mimeType: "audio/webm",
            bytes: new Uint8Array([1, 2, 3]),
          });
          assert.deepEqual(hasil, {
            fileId: "fileIdRetry",
            link: "https://drive.google.com/file/d/fileIdRetry/view?usp=drivesdk",
          });
        },
      );
    } finally {
      globalThis.fetch = fetchAsli;
    }
    assert.equal(panggilan, 2, "sukses pada percobaan kedua harus berhenti");
  });

  test("uploadAudioToDrive berhasil pada percobaan kedua sesudah balasan ok false", async () => {
    const fetchAsli = globalThis.fetch;
    let panggilan = 0;
    globalThis.fetch = (async () => {
      panggilan++;
      if (panggilan === 1) {
        return new Response(
          JSON.stringify({ ok: false, error: "sedang_penuh" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          id: "fileIdKedua",
          url: "https://drive.google.com/file/d/fileIdKedua/view?usp=drivesdk",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      await denganEnvUpload(
        { url: "https://script.google.com/macros/s/uji/exec", secret: "token-uji" },
        async () => {
          const hasil = await uploadAudioToDrive({
            fileName: "Anya - Soal 2.webm",
            mimeType: "audio/webm",
            bytes: new Uint8Array([4, 5]),
          });
          assert.equal(hasil.fileId, "fileIdKedua");
        },
      );
    } finally {
      globalThis.fetch = fetchAsli;
    }
    assert.equal(panggilan, 2);
  });

  test("uploadAudioToDrive berhasil pada percobaan kedua sesudah status HTTP galat", async () => {
    const fetchAsli = globalThis.fetch;
    let panggilan = 0;
    globalThis.fetch = (async () => {
      panggilan++;
      if (panggilan === 1) {
        return new Response("Apps Script sibuk", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          id: "fileIdHttp",
          url: "https://drive.google.com/file/d/fileIdHttp/view?usp=drivesdk",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      await denganEnvUpload(
        { url: "https://script.google.com/macros/s/uji/exec", secret: "token-uji" },
        async () => {
          const hasil = await uploadAudioToDrive({
            fileName: "Anya - Soal 3.webm",
            mimeType: "audio/webm",
            bytes: new Uint8Array([6]),
          });
          assert.equal(hasil.fileId, "fileIdHttp");
        },
      );
    } finally {
      globalThis.fetch = fetchAsli;
    }
    assert.equal(panggilan, 2);
  });

  test("uploadAudioToDrive menyerah sesudah 3 percobaan jaringan gagal semua", async () => {
    const fetchAsli = globalThis.fetch;
    let panggilan = 0;
    globalThis.fetch = (async () => {
      panggilan++;
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    try {
      await denganEnvUpload(
        { url: "https://script.google.com/macros/s/uji/exec", secret: "token-uji" },
        async () => {
          await assert.rejects(
            uploadAudioToDrive({
              fileName: "Anya - Soal 1.webm",
              mimeType: "audio/webm",
              bytes: new Uint8Array([1]),
            }),
            /fetch failed/,
          );
        },
      );
    } finally {
      globalThis.fetch = fetchAsli;
    }
    assert.equal(panggilan, 3, "harus berhenti tepat pada 3 percobaan");
  });

  test("uploadAudioToDrive tidak memanggil fetch sama sekali bila env belum terpasang", async () => {
    const fetchAsli = globalThis.fetch;
    let panggilan = 0;
    globalThis.fetch = (async () => {
      panggilan++;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await denganEnvUpload({}, async () => {
        await assert.rejects(
          uploadAudioToDrive({
            fileName: "Anya - Soal 1.webm",
            mimeType: "audio/webm",
            bytes: new Uint8Array([1]),
          }),
          /UPLOAD_NOT_CONFIGURED/,
        );
      });
    } finally {
      globalThis.fetch = fetchAsli;
    }
    assert.equal(panggilan, 0, "konfigurasi kosong tidak boleh dicoba ulang");
  });
});

describe("klien post tes: ketahanan kirim", () => {
  test("klien memakai helper unggah dengan satu percobaan ulang jaringan", () => {
    assert.ok(studentClient.includes("fetchUnggahJawaban"));
    assert.ok(studentClient.includes("await fetchUnggahJawaban(form)"));
  });

  test("kegagalan kirim mengembalikan fase ke recorded, bukan menghapus rekaman", () => {
    assert.ok(studentClient.includes('setPhase("recorded")'));
    const jumlahKosongkanBlob = studentClient
      .split("blobRef.current = null")
      .length - 1;
    assert.equal(
      jumlahKosongkanBlob,
      1,
      "blob hanya boleh dikosongkan di Rekam Ulang, bukan di jalur galat kirim",
    );
  });
});
