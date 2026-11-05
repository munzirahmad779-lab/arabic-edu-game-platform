import { KARTU_HAFALAN_HTML } from "@/modules/kartu-hafalan/kartu-html";

// Kartu Hafalan: alat guru mandiri (satu berkas HTML utuh, tanpa API).
// Rute ini berada di bawah /game/* sehingga ikut gerbang sesi guru pada
// middleware; tamu tanpa login diarahkan ke /login seperti game mandiri lain.
export function GET() {
  return new Response(KARTU_HAFALAN_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
