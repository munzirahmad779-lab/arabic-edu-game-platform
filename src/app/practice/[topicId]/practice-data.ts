export type QuestionType = "multiple-choice" | "word-scramble" | "match-pairs";

export interface PracticeQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  promptAr?: string;
  phonetic?: string;
  audioText?: string;
  options?: Array<{ id: string; text: string; textAr?: string }>;
  correctOptionId?: string;
  // For word-scramble:
  targetSentence?: string;
  scrambleWords?: string[];
  // For match-pairs:
  pairs?: Array<{ id: string; ar: string; idMeaning: string }>;
  explanation: string;
}

export interface PracticeTopicData {
  id: string;
  title: string;
  titleAr: string;
  desc: string;
  icon: string;
  questions: PracticeQuestion[];
}

export const TOPIC_DATA_REGISTRY: Record<string, PracticeTopicData> = {
  "mufradat-dasar": {
    id: "mufradat-dasar",
    title: "Kosakata Rumah & Sekolah",
    titleAr: "مُفْرَدَاتُ البَيْتِ وَالمَدْرَسَةِ",
    desc: "Kenali nama-nama benda di sekitarmu dalam bahasa Arab dengan pelafalan asli.",
    icon: "🏠",
    questions: [
      {
        id: "muf-1",
        type: "multiple-choice",
        prompt: "Apa arti dari kosakata berikut?",
        promptAr: "كِتَابٌ",
        phonetic: "Kitaabun",
        audioText: "كِتَابٌ",
        options: [
          { id: "a", text: "Buku Pelajaran" },
          { id: "b", text: "Pena / Pulpen" },
          { id: "c", text: "Meja Belajar" },
          { id: "d", text: "Pintu Masuk" },
        ],
        correctOptionId: "a",
        explanation: "كِتَابٌ (Kitaabun) artinya buku. Kata ini serumpun dengan kata 'maktabah' (perpustakaan) dan 'kataba' (menulis).",
      },
      {
        id: "muf-2",
        type: "multiple-choice",
        prompt: "Pilihlah bahasa Arab yang tepat untuk 'Pena / Pulpen':",
        options: [
          { id: "a", text: "قَلَمٌ", textAr: "Qalamun" },
          { id: "b", text: "بَابٌ", textAr: "Baabun" },
          { id: "c", text: "فَصْلٌ", textAr: "Fashlun" },
          { id: "d", text: "كُرْسِيٌّ", textAr: "Kursiyyun" },
        ],
        correctOptionId: "a",
        audioText: "قَلَمٌ",
        explanation: "قَلَمٌ (Qalamun) adalah pulpen atau alat tulis pena.",
      },
      {
        id: "muf-3",
        type: "multiple-choice",
        prompt: "Apa arti dari kosakata berikut?",
        promptAr: "مَدْرَسَةٌ",
        phonetic: "Madrasatun",
        audioText: "مَدْرَسَةٌ",
        options: [
          { id: "a", text: "Sekolah" },
          { id: "b", text: "Masjid" },
          { id: "c", text: "Pasar" },
          { id: "d", text: "Rumah" },
        ],
        correctOptionId: "a",
        explanation: "مَدْرَسَةٌ (Madrasatun) artinya sekolah (tempat belajar).",
      },
      {
        id: "muf-4",
        type: "word-scramble",
        prompt: "Susun kata-kata berikut menjadi kalimat: 'Ini buku baru'",
        targetSentence: "هَذَا كِتَابٌ جَدِيدٌ",
        scrambleWords: ["جَدِيدٌ", "هَذَا", "كِتَابٌ"],
        audioText: "هَذَا كِتَابٌ جَدِيدٌ",
        explanation: "Susunan yang benar: هَذَا (ini, mudzakkar) + كِتَابٌ (buku) + جَدِيدٌ (baru, sifat mengikuti sifat benda).",
      },
      {
        id: "muf-5",
        type: "multiple-choice",
        prompt: "Benda yang ada di depan kelas untuk menulis dengan kapur/spidol adalah:",
        options: [
          { id: "a", text: "سَبُّورَةٌ", textAr: "Sabbuuratun (Papan Tulis)" },
          { id: "b", text: "نَافِذَةٌ", textAr: "Naafidzatun (Jendela)" },
          { id: "c", text: "سَاعَةٌ", textAr: "Saa'atun (Jam)" },
          { id: "d", text: "مِسْطَرَةٌ", textAr: "Mistharatun (Penggaris)" },
        ],
        correctOptionId: "a",
        audioText: "سَبُّورَةٌ",
        explanation: "سَبُّورَةٌ (Sabbuuratun) adalah papan tulis.",
      },
      {
        id: "muf-6",
        type: "multiple-choice",
        prompt: "Apa arti dari kata 'حَقِيبَةٌ' (Haqiybatun)?",
        promptAr: "حَقِيبَةٌ",
        phonetic: "Haqiybatun",
        audioText: "حَقِيبَةٌ",
        options: [
          { id: "a", text: "Tas Sekolah" },
          { id: "b", text: "Sepatu" },
          { id: "c", text: "Seragam" },
          { id: "d", text: "Topi" },
        ],
        correctOptionId: "a",
        explanation: "حَقِيبَةٌ (Haqiybatun) artinya tas sekolah atau koper jinjing.",
      },
      {
        id: "muf-7",
        type: "word-scramble",
        prompt: "Susun kata-kata berikut menjadi kalimat: 'Kelas ini luas'",
        targetSentence: "الفَصْلُ وَاسِعٌ",
        scrambleWords: ["وَاسِعٌ", "الفَصْلُ"],
        audioText: "الفَصْلُ وَاسِعٌ",
        explanation: "Susunan mubtada' dan khobar: الفَصْلُ (Kelas itu) + وَاسِعٌ (luas).",
      },
    ],
  },
  "jam-waktu": {
    id: "jam-waktu",
    title: "Jam & Waktu",
    titleAr: "السَّاعَةُ وَالأَوْقَاتُ",
    desc: "Belajar membaca jam, menit, pagi, siang, dan malam dalam bahasa Arab.",
    icon: "⏰",
    questions: [
      {
        id: "jam-1",
        type: "multiple-choice",
        prompt: "Pukul berapa sekarang jika tertulis:",
        promptAr: "السَّاعَةُ الوَاحِدَةُ",
        phonetic: "As-Saa'atul Waahidah",
        audioText: "السَّاعَةُ الوَاحِدَةُ",
        options: [
          { id: "a", text: "Pukul 01.00 (Jam Satu)" },
          { id: "b", text: "Pukul 02.00 (Jam Dua)" },
          { id: "c", text: "Pukul 11.00 (Jam Sebelas)" },
          { id: "d", text: "Pukul 12.00 (Jam Dua Belas)" },
        ],
        correctOptionId: "a",
        explanation: "الوَاحِدَةُ bermakna kesatu / jam satu.",
      },
      {
        id: "jam-2",
        type: "multiple-choice",
        prompt: "Pilihlah bahasa Arab untuk kata 'Pagi Hari':",
        options: [
          { id: "a", text: "صَبَاحًا", textAr: "Shobaahan" },
          { id: "b", text: "مَسَاءً", textAr: "Masaa-an (Sore)" },
          { id: "c", text: "لَيْلًا", textAr: "Lailan (Malam)" },
          { id: "d", text: "نَهَارًا", textAr: "Nahaaran (Siang)" },
        ],
        correctOptionId: "a",
        audioText: "صَبَاحًا",
        explanation: "صَبَاحًا (Shobaahan) artinya di pagi hari. Bandingkan dengan sapaan 'Shobaahul khoir'.",
      },
      {
        id: "jam-3",
        type: "multiple-choice",
        prompt: "Bagaimana cara menanyakan jam dalam bahasa Arab?",
        options: [
          { id: "a", text: "كَمِ السَّاعَةُ الآنَ؟", textAr: "Kamis-saa'atul aan?" },
          { id: "b", text: "مَا هَذَا؟", textAr: "Maa haadzaa?" },
          { id: "c", text: "أَيْنَ أَنْتَ؟", textAr: "Aina anta?" },
          { id: "d", text: "مَنْ هَذَا؟", textAr: "Man haadzaa?" },
        ],
        correctOptionId: "a",
        audioText: "كَمِ السَّاعَةُ الآنَ؟",
        explanation: "كَمِ السَّاعَةُ الآنَ؟ (Kamis-saa'atul aan?) artinya 'Jam berapa sekarang?'.",
      },
      {
        id: "jam-4",
        type: "word-scramble",
        prompt: "Susun kata-kata berikut: 'Saya bangun pada jam lima pagi'",
        targetSentence: "أَسْتَيْقِظُ فِي السَّاعَةِ الخَامِسَةِ صَبَاحًا",
        scrambleWords: ["صَبَاحًا", "أَسْتَيْقِظُ", "الخَامِسَةِ", "فِي", "السَّاعَةِ"],
        audioText: "أَسْتَيْقِظُ فِي السَّاعَةِ الخَامِسَةِ صَبَاحًا",
        explanation: "أَسْتَيْقِظُ (saya bangun) + فِي السَّاعَةِ الخَامِسَةِ (pada jam lima) + صَبَاحًا (pagi hari).",
      },
      {
        id: "jam-5",
        type: "multiple-choice",
        prompt: "Apa arti dari 'وَالنِّصْف' dalam penyebutan jam?",
        promptAr: "وَالنِّصْفُ",
        phonetic: "Wan-Nishfu",
        audioText: "وَالنِّصْفُ",
        options: [
          { id: "a", text: "Lebih 30 Menit (Setengah)" },
          { id: "b", text: "Lebih 15 Menit (Seperempat)" },
          { id: "c", text: "Kurang 10 Menit" },
          { id: "d", text: "Tepat Jam Pas" },
        ],
        correctOptionId: "a",
        explanation: "النِّصْفُ artinya setengah (30 menit). Sedangkan seperempat (15 menit) adalah الرُّبْعُ.",
      },
    ],
  },
  "bilangan-angka": {
    id: "bilangan-angka",
    title: "Bilangan 1 sampai 20",
    titleAr: "الأَعْدَادُ وَالأَرْقَامُ",
    desc: "Kuasai hitungan dan penyebutan bilangan mudzakkar dan muannats.",
    icon: "🔢",
    questions: [
      {
        id: "num-1",
        type: "multiple-choice",
        prompt: "Angka Arab berikut melambangkan bilangan berapa?",
        promptAr: "خَمْسَةٌ (٥)",
        phonetic: "Khamsatun",
        audioText: "خَمْسَةٌ",
        options: [
          { id: "a", text: "5 (Lima)" },
          { id: "b", text: "0 (Nol)" },
          { id: "c", text: "6 (Enam)" },
          { id: "d", text: "7 (Tujuh)" },
        ],
        correctOptionId: "a",
        explanation: "Bentuk ٥ dalam angka Arab timur adalah angka 5 (Khamsah), jangan tertukar dengan angka 0 yang ditulis titik (•).",
      },
      {
        id: "num-2",
        type: "multiple-choice",
        prompt: "Bahasa Arab untuk angka 10 adalah:",
        options: [
          { id: "a", text: "عَشَرَةٌ (١٠)", textAr: "'Asyaratun" },
          { id: "b", text: "تِسْعَةٌ (٩)", textAr: "Tis'atun" },
          { id: "c", text: "ثَمَانِيَةٌ (٨)", textAr: "Tsamaaniyatun" },
          { id: "d", text: "سَبْعَةٌ (٧)", textAr: "Sab'atun" },
        ],
        correctOptionId: "a",
        audioText: "عَشَرَةٌ",
        explanation: "عَشَرَةٌ ('Asyarah) melambangkan bilangan sepuluh (10).",
      },
      {
        id: "num-3",
        type: "multiple-choice",
        prompt: "Berapakah hasil dari: ثَلَاثَةٌ + اثْنَانِ (3 + 2)?",
        options: [
          { id: "a", text: "خَمْسَةٌ (5)" },
          { id: "b", text: "أَرْبَعَةٌ (4)" },
          { id: "c", text: "سِتَّةٌ (6)" },
          { id: "d", text: "سَبْعَةٌ (7)" },
        ],
        correctOptionId: "a",
        audioText: "خَمْسَةٌ",
        explanation: "Tsalatsah (3) ditambah Itsnaani (2) sama dengan Khamsah (5).",
      },
      {
        id: "num-4",
        type: "word-scramble",
        prompt: "Susun angka secara urut: 'Satu, Dua, Tiga'",
        targetSentence: "وَاحِدٌ اثْنَانِ ثَلَاثَةٌ",
        scrambleWords: ["ثَلَاثَةٌ", "وَاحِدٌ", "اثْنَانِ"],
        audioText: "وَاحِدٌ اثْنَانِ ثَلَاثَةٌ",
        explanation: "Urutan hitungan dasar: 1 = وَاحِدٌ, 2 = اثْنَانِ, 3 = ثَلَاثَةٌ.",
      },
      {
        id: "num-5",
        type: "multiple-choice",
        prompt: "Apa arti dari 'عِشْرُونَ' (Isyruuna)?",
        promptAr: "عِشْرُونَ",
        phonetic: "'Isyruuna",
        audioText: "عِشْرُونَ",
        options: [
          { id: "a", text: "20 (Dua Puluh)" },
          { id: "b", text: "12 (Dua Belas)" },
          { id: "c", text: "200 (Dua Ratus)" },
          { id: "d", text: "2 (Dua)" },
        ],
        correctOptionId: "a",
        explanation: "عِشْرُونَ ('Isyruuna) artinya dua puluh (20).",
      },
    ],
  },
  "percakapan-harian": {
    id: "percakapan-harian",
    title: "Percakapan Santai (At-Ta'aruf)",
    titleAr: "التَّعَارُفُ وَالحِوَارُ اليَوْمِيُّ",
    desc: "Latihan menyusun kalimat tanya dan jawab saat berkenalan dengan teman baru.",
    icon: "💬",
    questions: [
      {
        id: "hiwar-1",
        type: "multiple-choice",
        prompt: "Jika seseorang menyapa: 'كَيْفَ حَالُكَ؟' (Bagaimana kabarmu?), jawaban yang tepat adalah:",
        promptAr: "كَيْفَ حَالُكَ؟",
        audioText: "كَيْفَ حَالُكَ؟",
        options: [
          { id: "a", text: "أَنَا بِخَيْرٍ، وَالحَمْدُ لِلَّهِ", textAr: "Saya baik-baik saja, alhamdulillah" },
          { id: "b", text: "اسْمِي أَحْمَدُ", textAr: "Nama saya Ahmad" },
          { id: "c", text: "مَعَ السَّلَامَةِ", textAr: "Selamat tinggal" },
          { id: "d", text: "أَنَا مِنْ إِنْدُونِيسِيَا", textAr: "Saya dari Indonesia" },
        ],
        correctOptionId: "a",
        explanation: "Jawaban standar untuk menanyakan kabar adalah 'بِخَيْرٍ، وَالحَمْدُ لِلَّهِ' (Alhamdulillah baik).",
      },
      {
        id: "hiwar-2",
        type: "word-scramble",
        prompt: "Susun kalimat tanya: 'Siapa namamu?' (untuk laki-laki):",
        targetSentence: "مَا اسْمُكَ؟",
        scrambleWords: ["اسْمُكَ؟", "مَا"],
        audioText: "مَا اسْمُكَ؟",
        explanation: "مَا (apa / siapa) + اسْمُكَ (namamu, untuk lawan bicara laki-laki). Jika perempuan menjadi اسْمُكِ.",
      },
      {
        id: "hiwar-3",
        type: "multiple-choice",
        prompt: "Apa ucapan balasan jika seseorang berterima kasih 'شُكْرًا' (Syukran)?",
        options: [
          { id: "a", text: "عَفْوًا", textAr: "'Afwan (Sama-sama)" },
          { id: "b", text: "أَهْلًا وَسَهْلًا", textAr: "Ahlan wa sahlan (Selamat datang)" },
          { id: "c", text: "صَبَاحَ الخَيْرِ", textAr: "Shobaahal khoir (Selamat pagi)" },
          { id: "d", text: "إِلَى اللِّقَاءِ", textAr: "Ilal liqoo' (Sampai jumpa)" },
        ],
        correctOptionId: "a",
        audioText: "عَفْوًا",
        explanation: "عَفْوًا ('Afwan) adalah jawaban sopan untuk 'Syukran' yang berarti 'sama-sama / kembali'.",
      },
      {
        id: "hiwar-4",
        type: "word-scramble",
        prompt: "Susun jawaban: 'Saya seorang siswa baru'",
        targetSentence: "أَنَا طَالِبٌ جَدِيدٌ",
        scrambleWords: ["جَدِيدٌ", "طَالِبٌ", "أَنَا"],
        audioText: "أَنَا طَالِبٌ جَدِيدٌ",
        explanation: "أَنَا (Saya) + طَالِبٌ (siswa) + جَدِيدٌ (baru).",
      },
    ],
  },
  "tata-bahasa-dhomir": {
    id: "tata-bahasa-dhomir",
    title: "Kata Ganti (Dhomir Munfashil)",
    titleAr: "الضَّمَائِرُ المُنْفَصِلَةُ",
    desc: "Pahami perbedaan Hua, Huma, Hum, Anta, Anti, hingga Nahnu dengan tepat.",
    icon: "🕌",
    questions: [
      {
        id: "dhomir-1",
        type: "multiple-choice",
        prompt: "Kata ganti 'هُوَ' (Huwa) digunakan untuk merujuk kepada:",
        promptAr: "هُوَ",
        phonetic: "Huwa",
        audioText: "هُوَ",
        options: [
          { id: "a", text: "Dia (1 orang laki-laki)" },
          { id: "b", text: "Dia (1 orang perempuan)" },
          { id: "c", text: "Kamu (1 orang laki-laki)" },
          { id: "d", text: "Mereka (banyak orang)" },
        ],
        correctOptionId: "a",
        explanation: "هُوَ (Huwa) adalah dhomir ghoib mufrad mudzakkar (kata ganti orang ketiga tunggal laki-laki).",
      },
      {
        id: "dhomir-2",
        type: "multiple-choice",
        prompt: "Pilihlah dhomir yang tepat untuk 'Kami / Kita':",
        options: [
          { id: "a", text: "نَحْنُ", textAr: "Nahnu" },
          { id: "b", text: "أَنَا", textAr: "Ana (Saya)" },
          { id: "c", text: "أَنْتُمْ", textAr: "Antum (Kalian)" },
          { id: "d", text: "هُمْ", textAr: "Hum (Mereka)" },
        ],
        correctOptionId: "a",
        audioText: "نَحْنُ",
        explanation: "نَحْنُ (Nahnu) adalah dhomir mutakallim ma'al ghoir (kata ganti orang pertama jamak: kami/kita).",
      },
      {
        id: "dhomir-3",
        type: "word-scramble",
        prompt: "Susun kalimat: 'Dia (perempuan) adalah seorang guru'",
        targetSentence: "هِيَ مُعَلِّمَةٌ",
        scrambleWords: ["مُعَلِّمَةٌ", "هِيَ"],
        audioText: "هِيَ مُعَلِّمَةٌ",
        explanation: "هِيَ (Dia perempuan) berpasangan dengan kata muannats مُعَلِّمَةٌ (guru perempuan, berakhiran ta' marbuthah).",
      },
      {
        id: "dhomir-4",
        type: "multiple-choice",
        prompt: "Apa perbedaan antara 'أَنْتَ' (Anta) dan 'أَنْتِ' (Anti)?",
        options: [
          { id: "a", text: "Anta untuk kamu laki-laki, Anti untuk kamu perempuan" },
          { id: "b", text: "Anta untuk jamak, Anti untuk tunggal" },
          { id: "c", text: "Anta untuk masa lalu, Anti untuk sekarang" },
          { id: "d", text: "Keduanya memiliki arti yang sama persis tanpa perbedaan" },
        ],
        correctOptionId: "a",
        audioText: "أَنْتَ أَنْتِ",
        explanation: "أَنْتَ (fathah di huruf ta) = kamu (laki-laki). أَنْتِ (kasrah di huruf ta) = kamu (perempuan).",
      },
    ],
  },
};
