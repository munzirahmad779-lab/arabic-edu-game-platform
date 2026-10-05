const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const KEYS = {
  id: {
    pin_required: "PIN wajib diisi untuk kelas ini.",
    invalid_name: "Nama tidak valid.",
  },
  en: {
    pin_required: "PIN is required for this class.",
    invalid_name: "Invalid name.",
  },
  ar: {
    pin_required: "PIN مطلوب لهذا الفصل.",
    invalid_name: "الاسم غير صالح.",
  },
};

for (const lang of ["id", "en", "ar"]) {
  const p = path.join(ROOT, "src/lib/i18n", `${lang}.json`);
  if (!fs.existsSync(p)) {
    console.log(`SKIP: ${p}`);
    continue;
  }
  const raw = fs.readFileSync(p, "utf8");
  fs.writeFileSync(p + ".bak", raw);

  const obj = JSON.parse(raw);
  if (!obj.join_errors) obj.join_errors = {};
  obj.join_errors.pin_required = KEYS[lang].pin_required;
  obj.join_errors.invalid_name = KEYS[lang].invalid_name;

  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
  console.log(`OK: ${lang}.json`);
}

console.log("\nSelesai.");