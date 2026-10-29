/** Tambah atribut uji: data-panel pada panel, data-correct pada tombol opsi. */
const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "components", "games", "adu-tarik-dino", "Game.tsx");
let s = fs.readFileSync(p, "utf8");
const log = [];
const sub = (from, to, label) => {
  const before = s;
  s = s.replace(from, to);
  log.push(`${label}: ${before !== s ? "ok" : "GAGAL"}`);
};

sub(
  "                  key={`${slot.side}-${slot.idx}`}\n",
  "                  key={`${slot.side}-${slot.idx}`}\n                  data-panel={`${slot.side}-${slot.idx}`}\n",
  "data-panel",
);

sub(
  "                        key={opt}\n                        onClick={() => answer(slot, opt)}",
  '                        key={opt}\n                        data-correct={q?.correct === opt ? "1" : "0"}\n                        onClick={() => answer(slot, opt)}',
  "data-correct",
);

fs.writeFileSync(p, s, "utf8");
console.log(log.join("\n"));
