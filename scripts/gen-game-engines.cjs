/**
 * Regenerates one engine component per registered game slug.
 * Usage: node scripts/gen-game-engines.cjs
 * Output: src/modules/games-pack/engines/<slug>.tsx (32 files)
 */
const fs = require("fs");
const path = require("path");

const PALETTES = [
  ["from-emerald-900 via-teal-900 to-slate-950", "emerald"],
  ["from-indigo-900 via-slate-900 to-violet-950", "indigo"],
  ["from-amber-900 via-stone-900 to-emerald-950", "amber"],
  ["from-violet-900 via-purple-900 to-slate-950", "violet"],
  ["from-sky-900 via-indigo-900 to-slate-950", "sky"],
  ["from-rose-900 via-purple-900 to-indigo-950", "rose"],
  ["from-cyan-900 via-slate-900 to-blue-950", "cyan"],
  ["from-orange-900 via-amber-950 to-stone-950", "orange"],
];

const r = (prompt, options, correctIndex, explanation) => ({
  prompt,
  options,
  correctIndex,
  explanation,
});

const DATA = [
  ["porogapit-arena", "Porogapit Arena", "Latihan pembagian bersusun", "➗", "choice",
    "Hitung hasil pembagian, lalu pilih jawaban yang benar.",
    [r("24 ÷ 6 = ?", ["3", "4", "5", "6"], 1, "24 dibagi 6 sama dengan 4."),
     r("36 ÷ 9 = ?", ["3", "4", "5", "6"], 1, "36 dibagi 9 sama dengan 4.")]],
  ["math-domino-arena", "Math Domino Arena", "Cocokkan angka dengan hasilnya", "🁢", "pair",
    "Jodohkan operasi hitung dengan hasil yang tepat.",
    [r("7 + 5 = ?", ["10", "11", "12", "13"], 2, "7 ditambah 5 adalah 12."),
     r("9 + 8 = ?", ["15", "16", "17", "18"], 2, "9 ditambah 8 adalah 17.")]],
  ["jejak-angka", "Jejak Angka", "Ikuti urutan angka", "👣", "sequence",
    "Perhatikan pola, lalu pilih angka berikutnya.",
    [r("Lanjutkan: 2, 4, 6, 8, ...", ["9", "10", "11", "12"], 1, "Polanya bertambah 2, jadi berikutnya 10."),
     r("Lanjutkan: 5, 10, 15, ...", ["18", "20", "25", "30"], 1, "Polanya bertambah 5, jadi berikutnya 20.")]],
  ["helirescue", "Heli Rescue", "Selamatkan kata yang benar", "🚁", "choice",
    "Pilih arti kosakata Arab yang benar untuk menyelamatkan misi.",
    [r("ما معنى كَلِمَة (كِتَابٌ)؟", ["Buku", "Pena", "Meja", "Pintu"], 0, "كِتَابٌ berarti buku."),
     r("ما معنى (مَدْرَسَةٌ)؟", ["Rumah", "Sekolah", "Masjid", "Pasar"], 1, "مَدْرَسَةٌ berarti sekolah.")]],
  ["sciencelink", "Science Link", "Hubungkan sains dan kosakata", "🔬", "pair",
    "Hubungkan istilah Arab dengan maknanya.",
    [r("كَلِمَة (مَاءٌ) berarti ...", ["Air", "Api", "Udara", "Tanah"], 0, "مَاءٌ berarti air."),
     r("(شَمْسٌ) berarti ...", ["Bulan", "Bintang", "Matahari", "Awan"], 2, "شَمْسٌ berarti matahari.")]],
  ["banua-fruit-blast", "Banua Fruit Blast", "Ledakkan buah yang tepat", "🍉", "choice",
    "Pilih nama buah Arab yang sesuai.",
    [r("Buah (تُفَّاحٌ) adalah ...", ["Apel", "Jeruk", "Anggur", "Pisang"], 0, "تُفَّاحٌ berarti apel."),
     r("(مَوْزٌ) adalah ...", ["Mangga", "Pisang", "Semangka", "Stroberi"], 1, "مَوْزٌ berarti pisang.")]],
  ["si-pemanah", "Si Pemanah", "Panah tepat sasaran", "🏹", "choice",
    "Bidik lawan kata yang benar.",
    [r("Lawan kata (كَبِيرٌ) adalah ...", ["Besar", "Kecil", "Tinggi", "Lebar"], 1, "كَبِيرٌ = besar, lawannya kecil (صَغِيرٌ)."),
     r("Lawan kata (طَوِيلٌ) adalah ...", ["Pendek", "Tinggi", "Kecil", "Berat"], 0, "طَوِيلٌ = panjang/tinggi, lawannya pendek (قَصِيرٌ).")]],
  ["rimba-pedia", "Rimba Pedia", "Ensiklopedia rimba", "🌴", "choice",
    "Kenali nama hewan dalam bahasa Arab.",
    [r("(أَسَدٌ) adalah ...", ["Singa", "Harimau", "Gajah", "Kera"], 0, "أَسَدٌ berarti singa."),
     r("(فِيلٌ) adalah ...", ["Kuda", "Gajah", "Sapi", "Kambing"], 1, "فِيلٌ berarti gajah.")]],
  ["celestial-weaver", "Celestial Weaver", "Tenun konstelasi huruf", "✨", "puzzle",
    "Susun dan kenali urutan huruf Hijaiyah.",
    [r("Huruf Hijaiyah pertama adalah ...", ["أ", "ب", "ت", "ث"], 0, "Urutan pertama adalah alif (أ)."),
     r("Huruf Hijaiyah ketiga adalah ...", ["ت", "ث", "ج", "ح"], 0, "Urutannya: أ, ب, ت — ketiga adalah ت.")]],
  ["tanzib", "Tanzib", "Tata urutan yang benar", "🎯", "sequence",
    "Pilih lanjutan urutan yang tepat.",
    [r("Lanjutkan: 1, 3, 5, ...", ["6", "7", "8", "9"], 1, "Polanya bertambah 2, jadi berikutnya 7."),
     r("Lanjutkan abjad: ا, ب, ت, ...", ["ث", "ج", "ح", "خ"], 0, "Setelah ت adalah ث.")]],
  ["puzzle", "Puzzle", "Susun potongan kata", "🧩", "puzzle",
    "Hitung jumlah huruf penyusun kata.",
    [r("Kata (قَلَمٌ) tersusun dari ... huruf", ["2", "3", "4", "5"], 1, "ق ل م = 3 huruf."),
     r("Kata (بَيْتٌ) tersusun dari ... huruf", ["2", "3", "4", "5"], 1, "ب ي ت = 3 huruf.")]],
  ["martabak-pecahan", "Martabak Pecahan", "Bagi martabak dengan tepat", "🥞", "choice",
    "Hitung pecahan dari jumlah yang diberikan.",
    [r("1/2 dari 10 = ?", ["3", "4", "5", "6"], 2, "Setengah dari 10 adalah 5."),
     r("1/4 dari 20 = ?", ["4", "5", "6", "8"], 1, "Seperempat dari 20 adalah 5.")]],
  ["doodle", "Doodle", "Gambar dan kenali warna", "🎨", "color",
    "Pilih arti warna dalam bahasa Arab.",
    [r("Warna (أَحْمَرُ) adalah ...", ["Merah", "Biru", "Hijau", "Kuning"], 0, "أَحْمَرُ berarti merah."),
     r("(أَزْرَقُ) adalah ...", ["Hijau", "Biru", "Hitam", "Putih"], 1, "أَزْرَقُ berarti biru.")]],
  ["si-taktik", "Si Taktik", "Strategi langkah tepat", "♟", "choice",
    "Gunakan urutan operasi hitung yang benar.",
    [r("3 + 3 × 2 = ?", ["12", "9", "8", "6"], 1, "Perkalian didahulukan: 3 × 2 = 6, lalu 3 + 6 = 9."),
     r("2 + 2 × 5 = ?", ["20", "12", "10", "8"], 1, "2 × 5 = 10, lalu 2 + 10 = 12.")]],
  ["traditional", "Traditional", "Permainan tradisional Nusantara", "🏵", "choice",
    "Kenali permainan tradisional Indonesia.",
    [r("Permainan tradisional yang memakai biji/kerikil: ...", ["Congklak", "Catur", "Bola", "Lompat tali"], 0, "Congklak memakai biji/kerikil."),
     r("Permainan tradisional yang diterbangkan di angin: ...", ["Gasing", "Layang-layang", "Kelereng", "Egrang"], 1, "Layang-layang diterbangkan di angin.")]],
  ["space-war", "Space War", "Perang antariksa kata", "🚀", "choice",
    "Tembak arti kosakata antariksa yang benar.",
    [r("(نَجْمٌ) artinya ...", ["Bintang", "Bulan", "Matahari", "Langit"], 0, "نَجْمٌ berarti bintang."),
     r("(قَمَرٌ) artinya ...", ["Bumi", "Bulan", "Matahari", "Awan"], 1, "قَمَرٌ berarti bulan.")]],
  ["ai-basketball", "AI Basketball", "Lempar bola jawaban", "🏀", "choice",
    "Lempar jawaban hitung yang tepat ke ring.",
    [r("20 + 15 = ?", ["30", "35", "40", "45"], 1, "20 + 15 = 35."),
     r("50 - 18 = ?", ["28", "30", "32", "34"], 2, "50 - 18 = 32.")]],
  ["mancing-kata", "Mancing Kata", "Pancing kata yang benar", "🎣", "choice",
    "Pancing kosakata dengan arti yang tepat.",
    [r("(سَمَكٌ) artinya ...", ["Ikan", "Ayam", "Sapi", "Kambing"], 0, "سَمَكٌ berarti ikan."),
     r("(بَحْرٌ) artinya ...", ["Sungai", "Laut", "Danau", "Sumur"], 1, "بَحْرٌ berarti laut.")]],
  ["kancil", "Kancil", "Kecerdikan si kancil", "🦌", "choice",
    "Jawab pertanyaan tentang si kancil yang cerdik.",
    [r("Hewan yang terkenal cerdik dalam cerita Nusantara: ...", ["Kancil", "Kucing", "Ayam", "Bebek"], 0, "Kancil terkenal cerdik."),
     r("Kancil dalam bahasa Arab disebut ...", ["غَزَالٌ", "أَسَدٌ", "فِيلٌ", "قِطٌّ"], 0, "Kancil = غَزَالٌ.")]],
  ["nusaboard", "Nusa Board", "Peta nusantara", "🗺", "choice",
    "Jelajahi fakta nusantara.",
    [r("Ibu kota Indonesia adalah ...", ["Bandung", "Jakarta", "Surabaya", "Medan"], 1, "Ibu kota Indonesia adalah Jakarta."),
     r("Pulau terbesar di Indonesia adalah ...", ["Jawa", "Sumatra", "Kalimantan", "Bali"], 2, "Kalimantan adalah pulau terbesar di Indonesia.")]],
  ["jagoan-kata", "Jagoan Kata", "Jadi jagoan kosakata", "🦸", "choice",
    "Pilih arti kosakata profesi yang benar.",
    [r("(مُعَلِّمٌ) artinya ...", ["Guru", "Murid", "Dokter", "Petani"], 0, "مُعَلِّمٌ berarti guru."),
     r("(طَالِبٌ) artinya ...", ["Guru", "Murid", "Tukang", "Polisi"], 1, "طَالِبٌ berarti murid.")]],
  ["geo-squad", "Geo Squad", "Tim geometri", "📐", "choice",
    "Kenali bangun datar dan sifatnya.",
    [r("Bangun dengan 4 sisi sama panjang: ...", ["Persegi", "Segitiga", "Lingkaran", "Trapesium"], 0, "Persegi punya 4 sisi sama panjang."),
     r("Jumlah sisi segitiga adalah ...", ["2", "3", "4", "5"], 1, "Segitiga punya 3 sisi.")]],
  ["ruang-io", "Ruang IO", "Eksplorasi bangun ruang", "🧊", "choice",
    "Hitung unsur bangun ruang.",
    [r("Jumlah rusuk kubus adalah ...", ["8", "10", "12", "14"], 2, "Kubus punya 12 rusuk."),
     r("Jumlah sisi kubus adalah ...", ["4", "6", "8", "12"], 1, "Kubus punya 6 sisi.")]],
  ["gabung-ceria", "Gabung Ceria", "Gabungkan huruf ceria", "🤝", "puzzle",
    "Gabungkan huruf menjadi kata yang benar.",
    [r("Gabungkan: م + د + ر + س + ة = ...", ["مدرسة", "مسجد", "مكتب", "مكتبة"], 0, "Menjadi مَدْرَسَةٌ (sekolah)."),
     r("Gabungkan: ك + ت + ا + ب = ...", ["كتاب", "كبير", "كلمة", "كاتب"], 0, "Menjadi كِتَابٌ (buku).")]],
  ["color-link-junior", "Color Link Junior", "Hubungkan warna", "🌈", "color",
    "Hubungkan warna Arab dengan artinya.",
    [r("(أَخْضَرُ) artinya ...", ["Hijau", "Merah", "Biru", "Kuning"], 0, "أَخْضَرُ berarti hijau."),
     r("(أَصْفَرُ) artinya ...", ["Hitam", "Kuning", "Putih", "Ungu"], 1, "أَصْفَرُ berarti kuning.")]],
  ["adu-tarik-dino", "Adu Tarik Dino", "Tarik tambang dino", "🦖", "choice",
    "Tarik tambang dengan hitungan yang benar.",
    [r("10 + 10 + 5 = ?", ["20", "25", "30", "35"], 1, "10 + 10 + 5 = 25."),
     r("30 - 5 - 5 = ?", ["15", "20", "25", "30"], 1, "30 - 5 - 5 = 20.")]],
  ["tatap-hap", "Tatap Hap", "Ingat dan pilih cepat", "👁", "choice",
    "Ingat kata, lalu pilih artinya dengan cepat.",
    [r("(بَيْتٌ) artinya ...", ["Rumah", "Sekolah", "Kantor", "Toko"], 0, "بَيْتٌ berarti rumah."),
     r("(مَسْجِدٌ) artinya ...", ["Rumah", "Masjid", "Pasar", "Jalan"], 1, "مَسْجِدٌ berarti masjid.")]],
  ["cocok-logi", "Cocok Logi", "Logika mencocokkan", "🔗", "pair",
    "Gunakan logika untuk mencocokkan pernyataan.",
    [r("Jika A = B dan B = C, maka A ... C", ["≠", "=", ">", "<"], 1, "Kesamaan bersifat transitif: A = C."),
     r("Semua manusia hidup. Ali manusia. Maka Ali ...", ["hidup", "mati", "tidur", "berlari"], 0, "Ali termasuk manusia, jadi Ali hidup.")]],
  ["mesin-koleksi", "Mesin Koleksi", "Kumpulkan hasil mesin", "⚙", "choice",
    "Temukan pola mesin angka.",
    [r("Mesin: 2 → 4, 3 → 6, maka 5 → ...", ["7", "10", "12", "15"], 1, "Mesin mengalikan 2, jadi 5 → 10."),
     r("Mesin: 4 → 16, 5 → 20, maka 6 → ...", ["24", "26", "28", "30"], 0, "Mesin mengalikan 4, jadi 6 → 24.")]],
  ["pendekar-balon", "Pendekar Balon", "Pecahkan balon tepat", "🎈", "choice",
    "Pecahkan balon dengan jawaban yang benar.",
    [r("(بَالُونٌ) artinya ...", ["Balon", "Bola", "Buku", "Baju"], 0, "بَالُونٌ berarti balon."),
     r("Warna (أَبْيَضُ) adalah ...", ["Putih", "Hitam", "Merah", "Biru"], 0, "أَبْيَضُ berarti putih.")]],
  ["detektif-cilik", "Detektif Cilik", "Temukan petunjuk", "🕵", "choice",
    "Pecahkan petunjuk kecil untuk menemukan jawaban.",
    [r("Petunjuk: 2 + 2 = ?", ["3", "4", "5", "6"], 1, "2 + 2 = 4."),
     r("Petunjuk: huruf terakhir كِتَابٌ adalah ...", ["ك", "ت", "ا", "ب"], 3, "Kata كِتَابٌ berakhir dengan ب.")]],
  ["mewarnai", "Mewarnai", "Warnai sesuai perintah", "🖍", "color",
    "Pilih warna yang sesuai perintah.",
    [r("Warnai daun dengan warna ...", ["Hijau", "Merah", "Biru", "Hitam"], 0, "Daun umumnya hijau."),
     r("Warnai langit dengan warna ...", ["Hijau", "Biru", "Merah", "Kuning"], 1, "Langit umumnya biru.")]],
];

if (DATA.length !== 32) {
  console.error("Expected 32 game definitions, got", DATA.length);
  process.exit(1);
}

const outDir = path.resolve(process.cwd(), "src/modules/games-pack/engines");
fs.mkdirSync(outDir, { recursive: true });

function pascal(slug) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("")
    .replace(/[^A-Za-z0-9]/g, "");
}

let written = 0;
DATA.forEach((entry, i) => {
  const [slug, title, subtitle, emoji, mechanic, instructions, rounds] = entry;
  const [gradient, accent] = PALETTES[i % PALETTES.length];
  const theme = { slug, title, subtitle, emoji, gradient, accent, mechanic, instructions, rounds };
  const body = `"use client";

import { GameStage, type GameTheme } from "../game-stage";

const THEME: GameTheme = ${JSON.stringify(theme, null, 2)};

export default function ${pascal(slug)}Engine() {
  return <GameStage theme={THEME} />;
}
`;
  fs.writeFileSync(path.join(outDir, `${slug}.tsx`), body, "utf8");
  written += 1;
});

console.log(`generated ${written} engine files in src/modules/games-pack/engines`);
