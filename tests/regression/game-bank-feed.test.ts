import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mapBankQuestions } from "../../src/lib/game-bank-feed-core";

const Q = (id: string, text: string | null, key: string | null) => ({
  id,
  question_text: text,
  correct_option_key: key,
});
const O = (qid: string, key: string, text: string) => ({
  question_id: qid,
  option_key: key,
  option_text: text,
});
const fourOpts = (qid: string) => [
  O(qid, "A", "satu"),
  O(qid, "B", "dua"),
  O(qid, "C", "tiga"),
  O(qid, "D", "empat"),
];

describe("Umpan Bank Soal LMS untuk game mandiri", () => {
  test("soal lengkap terpetakan dengan kunci dan urutan opsi benar", () => {
    const out = mapBankQuestions([Q("q1", "Apa arti كِتَابٌ?", "B")], fourOpts("q1"));
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].options, ["satu", "dua", "tiga", "empat"]);
    assert.equal(out[0].correctIndex, 1);
    assert.equal(out[0].isArabic, true);
  });

  test("opsi yang datang tidak berurutan tetap disusun A-D", () => {
    const shuffled = [O("q1", "C", "tiga"), O("q1", "A", "satu"), O("q1", "D", "empat"), O("q1", "B", "dua")];
    const out = mapBankQuestions([Q("q1", "Ibukota?", "D")], shuffled);
    assert.deepEqual(out[0].options, ["satu", "dua", "tiga", "empat"]);
    assert.equal(out[0].correctIndex, 3);
    assert.equal(out[0].isArabic, false);
  });

  test("soal tanpa teks, tanpa kunci, atau opsi tidak lengkap dilewati", () => {
    const out = mapBankQuestions(
      [
        Q("q1", null, "A"),
        Q("q2", "Teks", null),
        Q("q3", "Teks", "A"),
        Q("q4", "Teks", "E"),
        Q("q5", "Teks", "A"),
      ],
      [
        ...fourOpts("q1"),
        ...fourOpts("q2"),
        O("q3", "A", "satu"), O("q3", "B", "dua"), O("q3", "C", "tiga"),
        ...fourOpts("q4"),
        O("q5", "A", "satu"), O("q5", "B", "  "), O("q5", "C", "tiga"), O("q5", "D", "empat"),
      ],
    );
    assert.equal(out.length, 0);
  });
});
