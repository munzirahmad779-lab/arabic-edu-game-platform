/**
 * Regression: porting pengerasan standalone (c187607 + standar 87cabc5)
 * ke salinan LMS yang tertinggal (laporan armada K40-K43, 6 Nov 2026).
 *
 * Cakupan:
 * 1. Fruit Blast LMS: parseCsvBank menolak kunci NaN (huruf di luar A-D,
 *    sel kosong) dan menghormati kutip pada pemecah CSV (dulu kunci
 *    menjadi undefined dan baris berkutip terpecah bergeser).
 * 2. Basket LMS: isQ menolak correctIndex di luar rentang (99, -1, 1.5)
 *    pada loadCustomBank dan loadBankOverrides.
 * 3. Space War LMS: kunci angka negatif pada impor Markdown/CSV ditolak
 *    dan dihitung sebagai dilewati (dulu dijepit diam-diam menjadi 0).
 * 4. Pemasangan statis: Basket startRound + kedua handler keluar
 *    mengosongkan timeoutsRef; dialog keluar Fruit membekukan timer dan
 *    loop rAF; dialog keluar Sigetteng membekukan kedua timer dan
 *    menggeser penanda tampil soal; opsi Arab Space War memakai dir rtl.
 *
 * Skenario perilaku dijalankan 3 kali dengan hasil identik (aturan user:
 * perbaikan teruji dengan pengulangan sampai 3 kali).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/* ------------------------------------------------------- stub storage */

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
};

import { parseCsvBank as parseFruitCsv } from "../../src/modules/banua-fruit-blast/modul/logic";
import {
  loadCustomBank as loadBasketCustom,
  loadBankOverrides as loadBasketOverrides,
} from "../../src/modules/ai-basketball/modul/logic";
import {
  parseCsvBank as parseSpaceCsv,
  parseMarkdownBank as parseSpaceMd,
} from "../../src/modules/space-war/modul/logic";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

/* ------------------------------------------------------------ fruit */

describe("Fruit Blast LMS: parseCsvBank menolak NaN dan menghormati kutip", () => {
  const csv = [
    "Soal sah angka?,A,B,C,D,2",
    "Kunci huruf E?,A,B,C,D,E",
    "Kunci huruf X?,A,B,C,D,X",
    "Kunci kosong?,A,B,C,D,",
    '"Soal, berkoma?",A,B,C,D,B',
    '"Kutip ""ganda"" di soal?",A,B,C,D,C',
  ].join("\n");

  test("kunci E/X/kosong dilewati, baris berkutip terbaca utuh, 3 kali identik", () => {
    for (let run = 1; run <= 3; run++) {
      const { items, skipped } = parseFruitCsv(csv, "arab");
      assert.equal(items.length, 3, `pengulangan ${run}: 3 soal sah`);
      assert.equal(skipped, 3, `pengulangan ${run}: 3 baris dilewati`);
      assert.equal(items[0].correct, "B");
      assert.equal(items[1].prompt, "Soal, berkoma?");
      assert.equal(items[1].correct, "B");
      assert.equal(items[2].prompt, 'Kutip "ganda" di soal?');
      assert.equal(items[2].correct, "C");
      assert.ok(
        items.every((q) => typeof q.correct === "string" && q.options.includes(q.correct)),
        "tidak ada soal berkunci undefined",
      );
    }
  });
});

/* ----------------------------------------------------------- basket */

describe("Basket LMS: isQ menolak correctIndex di luar rentang (standar 87cabc5)", () => {
  const q = (correctIndex: unknown) => ({
    prompt: "Soal?",
    options: ["A", "B", "C", "D"],
    correctIndex,
  });

  test("loadCustomBank: 99, -1, 1.5 tertolak; 0..3 lolos, 3 kali identik", () => {
    store.set(
      "ai-basketball:guru:v1",
      JSON.stringify({ name: "Uji", questions: [q(99), q(-1), q(1.5), q(0), q(3)] }),
    );
    for (let run = 1; run <= 3; run++) {
      const bank = loadBasketCustom();
      assert.deepEqual(
        bank.questions.map((x) => x.correctIndex),
        [0, 3],
        `pengulangan ${run}`,
      );
    }
  });

  test("loadBankOverrides: kunci 7 tertolak, kunci sah lolos, 3 kali identik", () => {
    store.set("ai-basketball:bank:v1", JSON.stringify({ arab: [q(7), q(2)] }));
    for (let run = 1; run <= 3; run++) {
      const out = loadBasketOverrides();
      assert.deepEqual(
        (out.arab ?? []).map((x) => x.correctIndex),
        [2],
        `pengulangan ${run}`,
      );
    }
  });
});

/* --------------------------------------------------------- space war */

describe("Space War LMS: kunci angka negatif ditolak terang-terangan", () => {
  test("CSV: negatif dilewati dan dihitung, bukan dijepit menjadi 0, 3 kali identik", () => {
    const csv = ["Berapakah 5 - 8?,-3", "Berapakah 2 + 2?,4", "soal,jawaban", "Pecahan?,A,B,C,D,B"].join("\n");
    for (let run = 1; run <= 3; run++) {
      const { questions, skipped } = parseSpaceCsv(csv);
      assert.equal(questions.length, 2, `pengulangan ${run}`);
      assert.equal(skipped, 1, `pengulangan ${run}: hanya baris negatif yang dihitung dilewati`);
      assert.equal(questions[0].answer, 4);
      assert.equal(questions[1].kind, "teks");
    }
  });

  test("Markdown: Jawaban negatif dilewati dan dihitung, 3 kali identik", () => {
    const md = ["## Soal", "Berapakah 3 - 10?", "Jawaban: -7", "", "## Soal", "Berapakah 6 x 7?", "Jawaban: 42"].join("\n");
    for (let run = 1; run <= 3; run++) {
      const { questions, skipped } = parseSpaceMd(md);
      assert.equal(questions.length, 1, `pengulangan ${run}`);
      assert.equal(skipped, 1, `pengulangan ${run}`);
      assert.equal(questions[0].answer, 42);
    }
  });
});

/* ------------------------------------------------- pemasangan statis */

describe("Pemasangan statis perbaikan perilaku", () => {
  test("Basket: startRound mengosongkan timeoutsRef lebih dulu dan kedua handler keluar ikut mengosongkan", () => {
    const src = read("src/modules/ai-basketball/modul/Game.tsx");
    assert.ok(src.includes("const clearTrackedTimeouts = useCallback("), "helper clearTrackedTimeouts ada");
    const start = src.indexOf("const startRound = useCallback");
    assert.notEqual(start, -1);
    const startBody = src.slice(start, start + 700);
    assert.ok(
      startBody.indexOf("clearTrackedTimeouts();") !== -1 &&
        startBody.indexOf("clearTrackedTimeouts();") < startBody.indexOf("setScreen(\"countdown\")"),
      "startRound mengosongkan timeout sebelum hitung mundur dimulai",
    );
    const exits = src.match(/clearTrackedTimeouts\(\);\s*\n\s*finishedRef\.current = true;/g) ?? [];
    assert.equal(exits.length, 2, "kedua handler keluar (dialog keluar + Ke Beranda) mengosongkan timeout");
  });

  test("Fruit: timer dan loop rAF bergerbang showExit", () => {
    const src = read("src/modules/banua-fruit-blast/modul/Game.tsx");
    const guards = src.match(/if \(screen !== "playing" \|\| showExit\) return;/g) ?? [];
    assert.equal(guards.length, 2, "dua effect (timer + rAF) bergerbang showExit");
    assert.ok(src.includes("}, [screen, endGame, showExit]);"), "deps timer memuat showExit");
    assert.ok(src.includes("}, [screen, spawnNext, doReshuffle, headerBottomOf, showExit]);"), "deps rAF memuat showExit");
  });

  test("Sigetteng: kedua timer bergerbang confirmQuit dan penanda tampil soal digeser", () => {
    const src = read("src/modules/sigetteng-getteng/modul/Game.tsx");
    const guards = src.match(/if \(screen !== "playing" \|\| winner \|\| confirmQuit\) return;/g) ?? [];
    assert.equal(guards.length, 2, "timer pertandingan + timer soal bergerbang confirmQuit");
    assert.ok(src.includes("}, [screen, winner, finish, confirmQuit]);"), "deps timer pertandingan memuat confirmQuit");
    assert.ok(src.includes("}, [screen, winner, beep, rebuildQueue, confirmQuit]);"), "deps timer soal memuat confirmQuit");
    assert.ok(src.includes("shownAtRef.current[k] += delta"), "penanda tampil soal digeser sebesar lama dialog");
  });

  test("Space War: opsi Arab memakai dir rtl dan form menolak kunci negatif dengan pemberitahuan", () => {
    const src = read("src/modules/space-war/modul/Game.tsx");
    assert.ok(src.includes('dir={aq.q.isArabic ? "rtl" : undefined}'), "tombol opsi Arab ber-dir rtl");
    assert.ok(!src.includes("isArabic ? undefined : undefined"), "ternary rtl rusak tidak tersisa");
    assert.ok(src.includes("Jawaban angka tidak boleh negatif"), "form tambah soal menolak negatif lewat notify");
  });

});
