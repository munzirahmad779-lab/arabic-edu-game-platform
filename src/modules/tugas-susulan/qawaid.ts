// Data qawaid (kaidah) Dars 1 s.d. 8 untuk fitur Tugas Susulan.
// Sumber Dars 1 s.d. 4: bagian al-Qawaid pada berkas modul-dars1.pdf
// s.d. modul-dars5.pdf di folder bahan-ajar PPMK SMAN 2 Barru (irisan
// berkas bergeser satu dars, qawaid Dars 1 ada di modul-dars2.pdf
// hal. cetak 5, Dars 2 di modul-dars3.pdf hal. 13, Dars 3 dan 4 di
// modul-dars4.pdf hal. 22 dan 31). Sumber Dars 5: panel Review
// Qawaid Dars 5 pada deck Dars 6 (dars6_builder_v2.py), karena
// bagian qawaid Dars 5 tidak ada di berkas modulnya sendiri
// (modul-dars5.pdf berakhir di tadrib hal. cetak 40). Sumber
// Dars 6: dars6_builder_v2.py, Dars 7: dars7_builder.py,
// Dars 8: sumber-dars8.md.

export type QawaidMeta = { dars: number; judul: string; isi: string[] };

export const DAFTAR_QAWAID: QawaidMeta[] = [
  {
    dars: 1,
    judul:
      "Al-Jumlah al-Ismiyyah al-Basithah dan Dhamir al-Mutakallim wa al-Mukhatab",
    isi: [
      "Al-Jumlah al-Ismiyyah adalah kalimat yang diawali dengan isim (kata benda).",
      "Polanya (ash-shighah): al-mubtada + al-khabar.",
      "Contoh: ana Ahmad (saya Ahmad), al-masjidu kabir (masjid itu besar), anti thalibah (kamu perempuan seorang siswi).",
      "Dhamir al-Mutakallim wa al-Mukhatab: ana artinya saya, anta artinya kamu (laki-laki), anti artinya kamu (perempuan).",
      "Contoh: anta thalib (kamu laki-laki seorang siswa), anti Fatimah (kamu perempuan Fatimah).",
    ],
  },
  {
    dars: 2,
    judul:
      "Ism al-Mudzakkar wa Ism al-Muannats dan al-Milkiyyah bi Dhamir al-Mutakallim",
    isi: [
      "Ism al-Mudzakkar adalah isim yang menunjukkan laki-laki (adz-dzakar).",
      "Ism al-Muannats adalah isim yang menunjukkan perempuan (al-untsa).",
      "Contoh pasangan mudzakkar dan muannats: ab dan umm (ayah dan ibu), akh dan ukht (saudara laki-laki dan saudara perempuan), jadd dan jaddah (kakek dan nenek).",
      "Contoh lain: amm dan ammah (paman dan bibi), al-ustadz dan al-ustadzah (guru laki-laki dan guru perempuan).",
      "Al-Milkiyyah dengan Dhamir al-Mutakallim: ya al-mutakallim (huruf ya, dibaca -i) diletakkan di akhir isim untuk menunjukkan kepemilikan bagi pembicara.",
      "Polanya: kata + ya al-mutakallim. Contoh: ab menjadi abi (ayahku), umm menjadi ummi (ibuku), akh menjadi akhi (saudara laki-lakiku), kitab menjadi kitabi (bukuku).",
    ],
  },
  {
    dars: 3,
    judul: "Ism al-Isyarah, as-Sual an asy-Syai, dan Alif Lam at-Ta'rif",
    isi: [
      "Ism al-Isyarah: hadza untuk al-mufrad al-mudzakkar, artinya ini (laki-laki/benda maskulin).",
      "Hadzihi untuk al-mufrad al-muannats, artinya ini (perempuan/benda feminin).",
      "Contoh: hadza kitab (ini buku), hadza fashl (ini kelas), hadzihi sabburah (ini papan tulis), hadzihi haqiqah (ini tas), hadzihi madrasah (ini sekolah).",
      "Bertanya tentang benda (as-sual an asy-syai): ma hadza untuk al-mufrad al-mudzakkar, ma hadzihi untuk al-mufrad al-muannats.",
      "Contoh tanya jawab: ma hadza? hadza kitab (apa ini? ini buku). Ma hadzihi? hadzihi haqiqah (apa ini? ini tas).",
      "Alif Lam at-Ta'rif: al- dipakai untuk at-ta'rif (membuat kata menjadi tertentu) pada isim.",
      "Contoh: kitab menjadi al-kitab, qalam menjadi al-qalam, fashl menjadi al-fashl, sabburah menjadi as-sabburah.",
    ],
  },
  {
    dars: 4,
    judul: "Dhamir al-Ghaib dan as-Sual bi Man",
    isi: [
      "Dhamir al-Ghaib: huwa untuk al-mufrad al-mudzakkar, artinya dia laki-laki.",
      "Hiya untuk al-mufrad al-muannats, artinya dia perempuan.",
      "Contoh: huwa thalib (dia laki-laki seorang siswa), hiya thalibah (dia perempuan seorang siswi), huwa shadiqi (dia laki-laki temanku), hiya shadiqati (dia perempuan temanku).",
      "Bertanya dengan man (as-sual bi man): man dipakai untuk bertanya tentang seseorang (asy-syakhsh).",
      "Polanya: man + ism al-isyarah (kata tunjuk).",
      "Contoh: man huwa? man hadza? dijawab hadza shadiqi (ini temanku). Man hiya? dijawab hiya Fatimah.",
    ],
  },
  {
    dars: 5,
    judul: "Al-Fi'l al-Mudhari' li Dhamir Ana dan as-Sa'ah",
    isi: [
      "Al-Fi'l al-Mudhari' (الْفِعْلُ الْمُضَارِعُ) untuk dhomir ana (أَنَا) dipakai untuk kegiatan yang dilakukan oleh saya (pembicara).",
      "Contoh: أَنَا أَسْتَيْقِظُ (Aku bangun) · أَنَا أَذْهَبُ (Aku pergi) · أَنَا آكُلُ (Aku makan) · أَنَا أَشْرَبُ (Aku minum).",
      "Contoh lain: أَنَا أَنَامُ (Aku tidur) · أَنَا أَتَعَلَّمُ (Aku belajar) · أَنَا أَقْرَأُ (Aku membaca).",
      "As-Sa'ah (السَّاعَةُ) dipakai untuk menyebut jam.",
      "Contoh: السَّاعَةُ الْوَاحِدَةُ (Jam satu) · السَّاعَةُ الثَّانِيَةُ (Jam dua) · السَّاعَةُ الثَّالِثَةُ (Jam tiga) · السَّاعَةُ الرَّابِعَةُ (Jam empat).",
    ],
  },
  {
    dars: 6,
    judul: "At-Tarakib Uhibbu / La Uhibbu dan Al-Mashdar",
    isi: [
      "Pola suka: أُحِبُّ + mashdar, contoh أُحِبُّ الْقِرَاءَةَ (Aku suka membaca).",
      "Pola tidak suka: لَا أُحِبُّ + mashdar, contoh لَا أُحِبُّ الطَّبْخَ (Aku tidak suka memasak).",
      "Bertanya hobi: مَا هِوَايَتُكَ؟ dijawab هِوَايَتِي + mashdar, contoh هِوَايَتِي السِّبَاحَةُ (Hobiku berenang).",
      "Tabel modul memasangkan fiil dengan mashdarnya: قَرَأَ menjadi قِرَاءَةٌ (membaca), كَتَبَ menjadi كِتَابَةٌ (menulis), رَسَمَ menjadi رَسْمٌ (menggambar).",
      "Pasangan lain: طَبَخَ menjadi طَبْخٌ (memasak), سَبَحَ menjadi سِبَاحَةٌ (berenang), لَعِبَ menjadi لَعِبٌ (bermain), شَاهَدَ menjadi مُشَاهَدَةٌ (menonton).",
      "Pola yang sering muncul: فَعَلَ ← فِعَالَة, contoh قَرَأَ ← قِرَاءَة dan سَبَحَ ← سِبَاحَة.",
    ],
  },
  {
    dars: 7,
    judul: "Huruf al-Jar dan Al-Jumlah al-Washfiyyah al-Basithah",
    isi: [
      "Huruf al-Jar dipakai untuk menyatakan tempat benda: نَسْتَخْدِمُ حُرُوفَ الْجَرِّ لِلتَّعْبِيرِ عَنْ مَكَانِ الْأَشْيَاءِ.",
      "مِنْ artinya dari, contoh أَنَا مِنَ الْمَدْرَسَةِ. · إِلَى artinya ke, contoh أَذْهَبُ إِلَى الْمَدْرَسَةِ.",
      "فِي artinya di/dalam, contoh الْكِتَابُ فِي الْحَقِيبَةِ. · عَلَى artinya di atas, contoh الْكِتَابُ عَلَى الطَّاوِلَةِ.",
      "بِ artinya dengan/di, contoh أَكْتُبُ بِالْقَلَمِ. · لِ artinya untuk/milik, contoh هٰذَا الْبَيْتُ لِأَبِيَّ.",
      "عَنْ artinya tentang/dari, contoh أَتَحَدَّثُ عَنِ الْبَيْتِ. · كَ artinya seperti, contoh الْبَيْتُ كَالْقَصْرِ.",
      "Untuk tema rumah, huruf jar yang paling sering dipakai menurut catatan modul: فِي، عَلَى، مِنْ، إِلَى.",
      "Al-Jumlah al-Washfiyyah al-Basithah, rumus modul: al-ism + al-makan + al-ism (kata benda + keterangan tempat + kata benda).",
      "Contoh: الْكِتَابُ عَلَى الطَّاوِلَةِ. (Buku itu di atas meja) · الْحَقِيبَةُ تَحْتَ الْكُرْسِيِّ. (Tas itu di bawah kursi) · السَّرِيرُ فِي غُرْفَةِ النَّوْمِ. (Kasur itu di dalam kamar tidur) · الْمَطْبَخُ أَمَامَ غُرْفَةِ الْجُلُوسِ. (Dapur itu di depan ruang keluarga)",
    ],
  },
  {
    dars: 8,
    judul: "Jumlah ath-Thalab al-Basithah dan al-Ism al-Mufrad wa al-Jam'",
    isi: [
      "Jumlah ath-Thalab al-Basithah (kalimat permintaan sederhana), kaidah modul: أُرِيدُ + اسْمٌ (uridu + isim).",
      "Contoh: أُرِيدُ مَاءً. · أُرِيدُ عَصِيرًا. · أُرِيدُ خُبْزًا. · أُرِيدُ حَلِيبًا. · أُرِيدُ أَرُزًّا.",
      "Bentuk sopan memakai مِنْ فَضْلِكَ, contoh أُرِيدُ مَاءً، مِنْ فَضْلِكَ. dan أُرِيدُ عَصِيرًا، مِنْ فَضْلِكَ.",
      "Al-Ism al-Mufrad: مَا دَلَّ عَلَى وَاحِدٍ (isim yang menunjukkan satu).",
      "Al-Jam': مَا دَلَّ عَلَى أَكْثَرَ مِنْ وَاحِدٍ (isim yang menunjukkan lebih dari satu).",
      "Pasangan mufrad dan jamak: تُفَّاحَةٌ menjadi تُفَّاحٌ · كِتَابٌ menjadi كُتُبٌ · كُوبٌ menjadi أَكْوَابٌ.",
      "Pasangan lain: فَصْلٌ menjadi فُصُولٌ · مُدَرِّسٌ menjadi مُدَرِّسُونَ.",
    ],
  },
];

export function qawaidDars(dars: number): QawaidMeta | undefined {
  return DAFTAR_QAWAID.find((d) => d.dars === dars);
}
