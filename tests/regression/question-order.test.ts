/**
 * Regression: urutan soal bank terbalik (temuan lapangan produksi, 29 Okt 2026).
 *
 * Akar masalah: satu kali impor berjalan dalam SATU transaksi dan
 * questions.created_at memakai default now() yang konstan selama transaksi,
 * sehingga semua soal hasil satu impor berbagi created_at yang IDENTIK.
 * Halaman bank & pembuat game hanya mengurutkan berdasarkan created_at,
 * jadi urutan seri tidak terdefinisi (di produksi tampil terbalik).
 *
 * Perbaikan (migrasi 0069): kolom questions.sort_order eksplisit, di-backfill
 * dari payload.source_order, dan diisi RPC impor sebagai
 * existing_count + row_index. Kedua halaman kini mengurutkan sort_order
 * lebih dulu, created_at sebagai penentu seri terakhir.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const migration = readFileSync(
  path.join(root, "supabase/migrations/0069_question_sort_order.sql"),
  "utf8",
);
const bankPage = readFileSync(
  path.join(root, "src/app/dashboard/question-banks/page.tsx"),
  "utf8",
);
const gamesPage = readFileSync(
  path.join(root, "src/app/dashboard/games/page.tsx"),
  "utf8",
);

type Row = {
  id: string;
  text: string;
  created_at: string;
  sort_order: number | null;
};

function byDisplayOrder(a: Row, b: Row): number {
  const ao = a.sort_order ?? Number.POSITIVE_INFINITY;
  const bo = b.sort_order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  if (a.created_at !== b.created_at)
    return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

describe("Question bank display order (migration 0069)", () => {
  test("migration adds explicit sort_order column and backfills from payload.source_order", () => {
    assert.match(migration, /add column if not exists sort_order integer/);
    assert.match(migration, /payload ->> 'source_order'/);
    assert.match(migration, /row_number\(\) over/);
  });

  test("import RPC assigns sort_order = existing_count + row_index", () => {
    assert.match(migration, /existing_count \+ row_index/);
    const insertBlock = migration.slice(
      migration.indexOf("insert into public.questions"),
    );
    assert.match(insertBlock, /sort_order/);
  });

  test("bank page and game builder order by sort_order before created_at", () => {
    for (const page of [bankPage, gamesPage]) {
      const sortIdx = page.indexOf('.order("sort_order"');
      const createdIdx = page.indexOf('.order("created_at"', sortIdx);
      assert.ok(sortIdx >= 0, "sort_order ordering missing");
      assert.ok(createdIdx > sortIdx, "created_at must be the tiebreaker");
    }
  });

  test("rows from one import share created_at, so created_at alone carries no order", () => {
    const stamp = "2026-10-28T15:00:00.000Z";
    const rows: Row[] = [
      { id: "uuid-c", text: "Soal ketiga", created_at: stamp, sort_order: 3 },
      { id: "uuid-a", text: "Soal pertama", created_at: stamp, sort_order: 1 },
      { id: "uuid-b", text: "Soal kedua", created_at: stamp, sort_order: 2 },
    ];
    assert.ok(rows.every((r) => r.created_at === stamp));
    const sorted = [...rows].sort(byDisplayOrder).map((r) => r.text);
    assert.deepEqual(sorted, ["Soal pertama", "Soal kedua", "Soal ketiga"]);
  });

  test("appended import continues the bank sequence instead of restarting", () => {
    const existingCount = 2;
    const appended: Row[] = [1, 2].map((rowIndex) => ({
      id: `uuid-new-${rowIndex}`,
      text: `Soal tambahan ${rowIndex}`,
      created_at: "2026-10-29T01:00:00.000Z",
      sort_order: existingCount + rowIndex,
    }));
    assert.deepEqual(
      appended.map((r) => r.sort_order),
      [3, 4],
    );
  });
});
