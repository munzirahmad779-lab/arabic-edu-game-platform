// Data qawaid (kaidah) Dars 1 s.d. 15 untuk fitur Tugas Susulan.
// Sumber Dars 1 s.d. 4: bagian al-Qawaid pada berkas modul-dars1.pdf
// s.d. modul-dars5.pdf di folder bahan-ajar PPMK SMAN 2 Barru (irisan
// berkas bergeser satu dars, qawaid Dars 1 ada di modul-dars2.pdf
// hal. cetak 5, Dars 2 di modul-dars3.pdf hal. 13, Dars 3 dan 4 di
// modul-dars4.pdf hal. 22 dan 31). Sumber Dars 5: panel Review
// Qawaid Dars 5 pada deck Dars 6 (dars6_builder_v2.py), karena
// bagian qawaid Dars 5 tidak ada di berkas modulnya sendiri
// (modul-dars5.pdf berakhir di tadrib hal. cetak 40). Sumber
// Dars 6: dars6_builder_v2.py, Dars 7: dars7_builder.py,
// Dars 8: sumber-dars8.md, Dars 9: sumber-dars9.md,
// Dars 10: sumber-dars10.md. Sumber Dars 11 s.d. 15:
// data-dars11.md s.d. data-dars15.md pada folder tugas-susulan
// (diringkas dari sumber-dars11.md s.d. sumber-dars15.md).
// Cakupan RPC tugas susulan diperluas menjadi Dars 1 s.d. 15 oleh
// migrasi 0125.

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
  {
    dars: 9,
    judul: "Fi'l al-Amr al-Basith dan Uslub an-Nashihah wa al-Irsyad",
    isi: [
      "Fi'l al-Amr adalah kata kerja perintah: فِعْلُ الْأَمْرِ هُوَ الْفِعْلُ الَّذِي نَسْتَخْدِمُهُ لِطَلَبِ فِعْلِ شَيْءٍ (fi'il amr adalah kata kerja yang kita gunakan untuk meminta dilakukannya sesuatu).",
      "Pasangan fi'il mudhari' dan fi'il amr pada tabel modul: يَغْسِلُ menjadi اِغْسِلْ (cucilah) · يَشْرَبُ menjadi اِشْرَبْ (minumlah) · يَأْكُلُ menjadi كُلْ (makanlah) · يُمَارِسُ menjadi مَارِسْ (lakukanlah).",
      "Pasangan lain: يَنَامُ menjadi نَمْ (tidurlah) · يَرْتَاحُ menjadi اِرْتَحْ (beristirahatlah) · يَنْظُرُ menjadi اُنْظُرْ (lihatlah) · يَذْهَبُ menjadi اِذْهَبْ (pergilah).",
      "Contoh dalam kalimat: اِغْسِلْ يَدَيْكَ. · اِشْرَبِ الْمَاءَ. · كُلِ الطَّعَامَ الصِّحِّيَّ. · مَارِسِ الرِّيَاضَةَ. · نَمْ مُبَكِّرًا.",
      "Uslub an-Nashihah wa al-Irsyad: fi'il amr juga dipakai untuk memberi nasihat sederhana, نَسْتَخْدِمُ فِعْلَ الْأَمْرِ لِإِعْطَاءِ نَصِيحَةٍ بَسِيطَةٍ.",
      "Contoh nasihat: اِغْسِلْ يَدَيْكَ قَبْلَ الطَّعَامِ. · اِشْرَبِ الْمَاءَ كَثِيرًا. · اِرْتَحْ قَلِيلًا.",
    ],
  },
  {
    dars: 10,
    judul: "Al-Fi'l al-Mudhari' dengan Dhamir Anta dan Kalimat at-Takrar",
    isi: [
      "Untuk dhomir أَنْتَ (kamu laki-laki), fi'il mudhari' tampil dalam bentuk yang diawali ta, seperti pada tabel modul.",
      "Pasangan pada tabel modul: يَلْعَبُ menjadi أَنْتَ تَلْعَبُ · يَسْبَحُ menjadi أَنْتَ تَسْبَحُ · يَجْرِي menjadi أَنْتَ تَجْرِي · يَرْكَبُ menjadi أَنْتَ تَرْكَبُ.",
      "Pasangan lain: يَشْرَبُ menjadi أَنْتَ تَشْرَبُ · يُمَارِسُ menjadi أَنْتَ تُمَارِسُ · يَمْشِي menjadi أَنْتَ تَمْشِي · يَذْهَبُ menjadi أَنْتَ تَذْهَبُ.",
      "Contoh dalam kalimat: أَنْتَ تَلْعَبُ كُرَةَ الْقَدَمِ. · أَنْتَ تُمَارِسُ الرِّيَاضَةَ. · أَنْتَ تَسْبَحُ مَرَّتَيْنِ فِي الْأُسْبُوعِ. · أَنْتَ تَرْكَبُ الدَّرَّاجَةَ.",
      "Kalimat at-Takrar adalah kata keterangan frekuensi: نَسْتَخْدِمُ كَلِمَاتٍ لِبَيَانِ عَدَدِ مَرَّاتِ فِعْلِ شَيْءٍ (kita memakai kata-kata untuk menyatakan berapa kali suatu perbuatan dilakukan).",
      "Kata takrar pada tabel modul: كُلَّ يَوْمٍ (setiap hari) · كُلَّ أُسْبُوعٍ (setiap minggu) · دَائِمًا (selalu) · غَالِبًا (biasanya/sering) · أَحْيَانًا (kadang-kadang) · نَادِرًا (jarang).",
    ],
  },
  {
    dars: 11,
    judul: "Zharf al-Makan, Ism al-Isyarah li al-Makan, dan as-Sual li al-Makan",
    isi: [
      "Zharf al-Makan adalah kata keterangan tempat. Kata zharf pada tabel modul: أَمَامَ (di depan) · خَلْفَ (di belakang) · فَوْقَ (di atas) · تَحْتَ (di bawah) · بَيْنَ (di antara) · جَانِبَ (di samping).",
      "Contoh zharf al-makan dalam kalimat: الْمَسْجِدُ أَمَامَ الْمَدْرَسَةِ. · السَّيَّارَةُ تَحْتَ الشَّجَرَةِ.",
      "Ism al-Isyarah li al-Makan adalah kata tunjuk untuk tempat: هُنَا untuk tempat yang dekat dan هُنَاكَ untuk tempat yang jauh, sebagaimana contoh modul.",
      "Contoh ism al-isyarah li al-makan: هُنَا الْمَكْتَبَةُ. · هُنَاكَ الْمَلْعَبُ.",
      "As-Sual li al-Makan adalah cara bertanya tentang tempat dengan pola modul: أَيْنَ + الِاسْمُ؟",
      "Contoh as-sual li al-makan: أَيْنَ الْفَصْلُ؟ الْفَصْلُ فِي الطَّابِقِ الثَّانِي.",
    ],
  },
  {
    dars: 12,
    judul: "Al-Jumlah al-Ismiyyah, An-Na't wa al-Man'ut, dan Kana wa Akhawatuha",
    isi: [
      "Al-Jumlah al-Ismiyyah adalah kalimat nominal yang tersusun dari الْمُبْتَدَأُ + الْخَبَرُ (mubtada dan khabar), seperti pada modul.",
      "Contoh al-Jumlah al-Ismiyyah pada modul: الْهَوَاءُ نَقِيٌّ · الْحَدِيقَةُ جَمِيلَةٌ.",
      "An-Na't (kata sifat) mengikuti al-Man'ut (kata yang disifati) dalam dua hal: النَّعْتُ يَتْبَعُ الْمَنْعُوتَ فِي التَّذْكِيرِ وَالتَّأْنِيثِ (mudzakkar dan muannats) serta التَّعْرِيفِ وَالتَّنْكِيرِ (ma'rifah dan nakirah).",
      "Contoh na't dan man'ut pada modul: شَجَرَةٌ كَبِيرَةٌ · الْبِيئَةُ النَّظِيفَةُ.",
      "Kana wa Akhawatuha adalah kata kerja bantu seperti كَانَ yang masuk pada jumlah ismiyyah dengan kaedah: تَرْفَعُ الْإِسْمَ وَتَنْصِبُ الْخَبَرَ (merafa'kan isimnya dan menashabkan khabarnya).",
      "Contoh kana pada modul: كَانَتِ الْبِيئَةُ نَظِيفَةً · كَانَ الْجَوُّ جَمِيلًا.",
    ],
  },
  {
    dars: 13,
    judul: "Al-Fi'l al-Mudhari', Huruf al-Jarr, dan as-Sual bi Kaifa",
    isi: [
      "Al-Fi'l al-Mudhari' pada Dars 13 ditabelkan dengan fi'il رَكِبَ untuk semua dhamir (kata ganti).",
      "Pasangan pada tabel modul: هُوَ يَرْكَبُ · هُمَا يَرْكَبَانِ · هُمْ يَرْكَبُونَ · هِيَ تَرْكَبُ · هُمَا تَرْكَبَانِ · هُنَّ يَرْكَبْنَ.",
      "Pasangan lain: أَنْتَ تَرْكَبُ · أَنْتُمَا تَرْكَبَانِ · أَنْتُمْ تَرْكَبُونَ · أَنْتِ تَرْكَبِينَ · أَنْتُمَا تَرْكَبَانِ · أَنْتُنَّ تَرْكَبْنَ · أَنَا أَرْكَبُ · نَحْنُ نَرْكَبُ.",
      "Contoh dalam kalimat: أَرْكَبُ الْحَافِلَةَ. · يَرْكَبُ أَحْمَدُ الدَّرَّاجَةَ.",
      "Huruf al-Jarr pada tabel modul: إِلَى (ke) · مِنْ (dari) · فِي (di).",
      "Contoh huruf al-jarr: أَذْهَبُ إِلَى الْمَدْرَسَةِ. · أَرْجِعُ مِنَ الْمَطَارِ.",
      "As-Sual bi Kaifa: bertanya tentang cara dengan pola كَيْفَ + الْفِعْلُ الْمُضَارِعُ.",
      "Contoh pada modul: كَيْفَ تَذْهَبُ؟ أَذْهَبُ بِالسَّيَّارَةِ.",
    ],
  },
  {
    dars: 14,
    judul: "Al-Fi'l al-Madhi, Zharf az-Zaman, dan as-Su'al bi Mata",
    isi: [
      "Al-Fi'l al-Madhi adalah kata kerja lampau; pada tabel modul, fi'il سَافَرَ (bepergian) ditasrif dengan seluruh dhamir.",
      "Pasangan pada tabel modul: هُوَ سَافَرَ · هُمَا سَافَرَا · هُمْ سَافَرُوا · هِيَ سَافَرَتْ.",
      "Pasangan lain: هُمَا سَافَرَتَا · هُنَّ سَافَرْنَ · أَنْتَ سَافَرْتَ · أَنْتُمَا سَافَرْتُمَا.",
      "Pasangan lain: أَنْتُمْ سَافَرْتُمْ · أَنْتِ سَافَرْتِ · أَنْتُمَا سَافَرْتُمَا · أَنْتُنَّ سَافَرْتُنَّ.",
      "Pasangan lain: أَنَا سَافَرْتُ · نَحْنُ سَافَرْنَا.",
      "Contoh dalam kalimat: سَافَرْتُ إِلَى بَالِي. · زُرْنَا الْمُتْحَفَ.",
      "Zharf az-Zaman adalah kata keterangan waktu; kata pada tabel modul: أَمْسِ (Kemarin) · الْيَوْمَ (Hari ini) · الْآنَ (Sekarang) · غَدًا (Besok).",
      "Contoh zharf az-zaman: سَافَرْتُ إِلَى الْجَبَلِ أَمْسِ. · أُسَافِرُ إِلَى الْقَرْيَةِ غَدًا.",
      "As-Su'al bi Mata adalah bertanya tentang waktu dengan pola modul: مَتَى + الْفِعْلُ الْمَاضِي.",
      "Contoh: مَتَى سَافَرْتَ إِلَى الْمَدِينَةِ؟ سَافَرْتُ إِلَى الْمَدِينَةِ أَمْسِ. · مَتَى سَافَرْتُمْ إِلَى الْقَرْيَةِ؟ سَافَرْنَا إِلَى الْقَرْيَةِ أَمْسِ.",
    ],
  },
  {
    dars: 15,
    judul: "Al-Mashdar dan La an-Nahiyah",
    isi: [
      "Al-Mashdar adalah kata benda yang dibentuk dari fi'il (kata kerja) dan menunjukkan perbuatannya, seperti pada tabel modul.",
      "Pasangan pada tabel modul: اِسْتَعْمَلَ menjadi اِسْتِعْمَالٌ · كَتَبَ menjadi كِتَابَةٌ · حَمَّلَ menjadi تَحْمِيلٌ.",
      "Contoh dalam kalimat: اِسْتِعْمَالُ الْحَاسُوبِ مُفِيدٌ. · تَحْمِيلُ التَّطْبِيقَاتِ التَّعْلِيمِيَّةِ.",
      "La an-Nahiyah adalah la yang dipakai untuk melarang; polanya pada modul: لَا + الْفِعْلُ الْمُضَارِعُ (la diikuti fi'il mudhari').",
      "Contoh pada modul: لَا تَسْتَعْمِلِ الْهَاتِفَ أَثْنَاءَ الدَّرْسِ.",
    ],
  },
];

export function qawaidDars(dars: number): QawaidMeta | undefined {
  return DAFTAR_QAWAID.find((d) => d.dars === dars);
}
