import type { QuestionImportRow } from "./excel";

export type GameThemeId =
  | "kahoot"
  | "excel_table"
  | "millionaire"
  | "jeopardy"
  | "memory_card"
  | "wordle"
  | "scramble"
  | "hangman"
  | "wheel_fortune"
  | "whack_mole"
  | "matching_column";

export const GAME_MD_TEMPLATES: Record<GameThemeId, string> = {
  excel_table: `# Format Tabel Kolom (Sesuai Template Excel)
# Anda bisa langsung Copy tabel dari Microsoft Excel / Google Sheets lalu Paste ke sini,
# atau tulis manual dengan pemisah tanda pipa (|):

| No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Jawaban Benar | Topik | Tingkat Kesulitan | Alasan |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Apa arti dari kata كِتَابٌ ? | Buku | Pena | Meja | Kursi | A | Mufrodat | Mudah | Buku tulis atau bacaan |
| 2 | Jam'u (bentuk jamak) dari kata طَالِبٌ adalah... | طُلَّابٌ | طَالِبَاتٌ | مَطَالِبُ | أَطْلَابٌ | A | Nahwu | Sedang | Jamak taksir mudzakkar |
| 3 | Fi'il madhi dari kata "يَكْتُبُ" adalah... | كَتَبَ | كِتَابَةٌ | كَاتِبٌ | اِكْتُبْ | A | Sharaf | Sedang | Fi'il tsulatsi mujarrad |
| 4 | "قَلَمٌ" artinya dalam bahasa Indonesia adalah... | Pena | Penggaris | Penghapus | Meja | A | Mufrodat | Mudah | Alat tulis tinta |
| 5 | Dhomir munfashil untuk orang pertama tunggal (saya) adalah... | أَنَا | نَحْنُ | أَنْتَ | هُوَ | A | Nahwu | Mudah | Kata ganti orang pertama |
`,

  kahoot: `# Kuis Kahoot Arena (4 Pilihan Ganda)

# Soal 1: Apa arti dari kata كِتَابٌ ?
- A. Buku [x]
- B. Pena
- C. Meja
- D. Kursi

# Soal 2: Jam'u (bentuk jamak) dari kata طَالِبٌ adalah...
- A. طُلَّابٌ [x]
- B. طَالِبَاتٌ
- C. مَطَالِبُ
- D. أَطْلَابٌ

# Soal 3: "قَلَمٌ" artinya adalah...
- A. Pena [x]
- B. Buku
- C. Penggaris
- D. Penghapus
`,

  millionaire: `# Kuis Who Wants to Be a Millionaire

# Soal 1: Jam'u dari kata طَالِبٌ adalah...
- A. طُلَّابٌ [x]
- B. طَالِبَاتٌ
- C. مَطَالِبُ
- D. أَطْلَابٌ

# Soal 2: Dhomir munfashil untuk mutakallim wahdah adalah...
- A. أَنَا [x]
- B. أَنْتَ
- C. هُوَ
- D. نَحْنُ

# Soal 3: Fi'il madhi dari kata "يَكْتُبُ" adalah...
- A. كَتَبَ [x]
- B. كِتَابَةٌ
- C. كَاتِبٌ
- D. اِكْتُبْ
`,

  jeopardy: `# Cerdas Cermat Matriks (5 Kategori)

## Kategori: Mufrodat
### 100: Terjemahkan kata كِتَابٌ
- A. Buku [x]
- B. Pena
- C. Meja
- D. Kursi

### 200: Terjemahkan kata مَكْتَبٌ
- A. Meja [x]
- B. Kursi
- C. Pintu
- D. Jendela

## Kategori: Nahwu
### 100: Fa'il dalam kalimat "قَرَأَ مُحَمَّدٌ" adalah...
- A. مُحَمَّدٌ [x]
- B. قَرَأَ
- C. كِتَاباً
- D. فِعْلٌ

### 200: Harof jar yang bermakna "di atas" adalah...
- A. عَلَى [x]
- B. فِي
- C. مِنْ
- D. إِلَى
`,

  memory_card: `# Pasangan Kartu Memori (Mufrodat & Terjemahan)
# Format: Kata Arab = Terjemahan Bahasa Indonesia

- كِتَابٌ = Buku
- قَلَمٌ = Pena
- مَكْتَبٌ = Meja
- بَابٌ = Pintu
- مَدْرَسَةٌ = Sekolah
- أُسْتَاذٌ = Guru
- حَاسُوبٌ = Komputer
- مِسْطَرَةٌ = Penggaris
`,

  wordle: `# Tebak Kata Hijaiyah (Arabic Wordle / Katla)
# Format: - Kata: Huruf/Kata (Petunjuk: Clue)

- Kata: م د ر س ة (Petunjuk: Tempat menuntut ilmu)
- Kata: ك ت ا ب ة (Petunjuk: Kegiatan menulis)
- Kata: م ك ت ب ة (Petunjuk: Ruang membaca buku)
- Kata: أ س ت ا ذ (Petunjuk: Pengajar di sekolah)
- Kata: ح ا س و ب (Petunjuk: Perangkat komputer)
`,

  scramble: `# Susun Kata Hijaiyah (Word Scramble)
# Format: - Kata: Kata Utuh Arab (Petunjuk: Clue)

- Kata: مَدْرَسَةٌ (Petunjuk: Tempat belajar)
- Kata: أُسْتَاذٌ (Petunjuk: Guru / Pengajar)
- Kata: حَاسُوبٌ (Petunjuk: Perangkat elektronik)
- Kata: مَكْتَبَةٌ (Petunjuk: Perpustakaan sekolah)
`,

  hangman: `# Manusia Salju Kata (Hangman Tebak Huruf)
# Format: - Kata: Kata Rahasia Arab (Petunjuk: Clue)

- Kata: مَسْجِدٌ (Petunjuk: Tempat ibadah umat Islam)
- Kata: قُرْآنٌ (Petunjuk: Kitab suci umat Islam)
- Kata: كَعْبَةٌ (Petunjuk: Kiblat shalat umat Islam)
- Kata: مَكَّةٌ (Petunjuk: Kota suci tempat Ka'bah)
`,

  wheel_fortune: `# Roda Keberuntungan Karnaval (Wheel of Fortune)
# Format: - Frasa: Frasa Mahfuzhat (Petunjuk: Clue)

- Frasa: اَلْعِلْمُ نُوْرٌ (Petunjuk: Ilmu adalah cahaya)
- Frasa: اَلصَّبْرُ يُعِيْنُ (Petunjuk: Kesabaran membantu setiap pekerjaan)
- Frasa: مَنْ جَدَّ وَجَدَ (Petunjuk: Barang siapa bersungguh-sungguh dia dapat)
- Frasa: اَلْوَقْتُ كَالسَّيْفِ (Petunjuk: Waktu bagaikan pedang)
`,

  whack_mole: `# Pukul Tikus Mufrodat (Whack-a-Mole)
# Format: Target: Nama Kategori Target
# Benar: Kata 1, Kata 2, Kata 3
# Salah: Distractor 1, Distractor 2, Distractor 3

Target: Peralatan Sekolah (Adawatul Madrosiyyah)
- Benar: قَلَمٌ, كِتَابٌ, مِسْطَرَةٌ, مِمْسَحَةٌ, كُرَّاسَةٌ
- Salah: سَيَّارَةٌ, بَقَرَةٌ, طَائِرَةٌ, هَاتِفٌ, شَجَرَةٌ
`,

  matching_column: `# Hubungkan Garis (Matching Column)
# Format: - Kata Arab -> Terjemahan Indonesia

- كِتَابٌ -> Buku
- قَلَمٌ -> Pena
- مَكْتَبٌ -> Meja
- كُرْسِيٌّ -> Kursi
- بَابٌ -> Pintu
- نَافِذَةٌ -> Jendela
`,
};

function parseTableOrTsvRows(lines: string[]): QuestionImportRow[] {
  const rows: QuestionImportRow[] = [];
  let rowCounter = 1;

  for (const rawLine of lines) {
    if (rawLine.startsWith("#")) continue;

    let cells: string[] = [];
    if (rawLine.includes("\t")) {
      cells = rawLine.split("\t").map((c) => c.trim());
    } else if (rawLine.includes("|")) {
      const parts = rawLine.split("|").map((c) => c.trim());
      if (parts[0] === "") parts.shift();
      if (parts[parts.length - 1] === "") parts.pop();
      cells = parts;
    }

    if (cells.length < 5) continue;

    // Skip divider row: |---|---|
    if (cells.every((c) => /^[-: ]+$/.test(c))) continue;

    // Skip header row
    const lowerJoined = cells.join(" ").toLowerCase();
    if (
      lowerJoined.includes("pertanyaan") ||
      lowerJoined.includes("pilihan a") ||
      lowerJoined.includes("jawaban benar") ||
      lowerJoined.includes("question")
    ) {
      continue;
    }

    let no = rowCounter;
    let question = "";
    let optA = "";
    let optB = "";
    let optC = "";
    let optD = "";
    let correctKeyRaw = "A";
    let topic = "Umum";
    let difficultyRaw = "medium";
    let explanation: string | null = null;

    const firstIsNumber = /^\d+$/.test(cells[0]);

    if (firstIsNumber && cells.length >= 6) {
      no = parseInt(cells[0], 10) || rowCounter;
      question = cells[1];
      optA = cells[2] || "";
      optB = cells[3] || "";
      optC = cells[4] || "";
      optD = cells[5] || "";
      correctKeyRaw = cells[6] || "A";
      if (cells[7]) topic = cells[7];
      if (cells[8]) difficultyRaw = cells[8];
      if (cells[9]) explanation = cells[9];
    } else if (cells.length >= 5) {
      question = cells[0];
      optA = cells[1] || "";
      optB = cells[2] || "";
      optC = cells[3] || "";
      optD = cells[4] || "";
      correctKeyRaw = cells[5] || "A";
      if (cells[6]) topic = cells[6];
      if (cells[7]) difficultyRaw = cells[7];
      if (cells[8]) explanation = cells[8];
    }

    if (!question || !optA) continue;

    let correctKey: "A" | "B" | "C" | "D" = "A";
    const cleanKey = correctKeyRaw.toUpperCase().trim();
    if (cleanKey === "A" || cleanKey === "B" || cleanKey === "C" || cleanKey === "D") {
      correctKey = cleanKey;
    } else if (cleanKey === optA.toUpperCase().trim()) {
      correctKey = "A";
    } else if (cleanKey === optB.toUpperCase().trim()) {
      correctKey = "B";
    } else if (cleanKey === optC.toUpperCase().trim()) {
      correctKey = "C";
    } else if (cleanKey === optD.toUpperCase().trim()) {
      correctKey = "D";
    }

    let difficulty: "easy" | "medium" | "hard" = "medium";
    const diffLower = difficultyRaw.toLowerCase();
    if (diffLower.includes("mudah") || diffLower.includes("easy")) {
      difficulty = "easy";
    } else if (diffLower.includes("sulit") || diffLower.includes("hard")) {
      difficulty = "hard";
    }

    rows.push({
      no: no || rowCounter,
      question,
      options: {
        A: optA || "Pilihan A",
        B: optB || "Pilihan B",
        C: optC || "Pilihan C",
        D: optD || "Pilihan D",
      },
      correctOptionKey: correctKey,
      topic: topic || "Umum",
      difficulty,
      hasMedia: false,
      mediaType: null,
      mediaFilename: null,
      maxPlayCount: null,
      explanation: explanation || null,
    });
    rowCounter++;
  }

  return rows;
}

export function parseMarkdownToImportRows(
  mdText: string,
  gameTheme: GameThemeId = "kahoot"
): { rows: QuestionImportRow[]; errors: string[] } {
  const lines = mdText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("//"));
  const rows: QuestionImportRow[] = [];
  const errors: string[] = [];

  // If theme is excel_table or text contains table/tsv lines, check table parser first
  if (gameTheme === "excel_table") {
    const tableRows = parseTableOrTsvRows(lines);
    if (tableRows.length > 0) {
      return { rows: tableRows, errors: [] };
    }
    errors.push("Tidak dapat menemukan baris tabel atau TSV yang valid. Pastikan format tabel memiliki kolom: No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Jawaban Benar");
    return { rows: [], errors };
  }

  // Auto-detect table format even if another theme was selected
  const autoTableRows = parseTableOrTsvRows(lines);
  if (autoTableRows.length > 0 && (gameTheme === "kahoot" || gameTheme === "millionaire" || gameTheme === "jeopardy")) {
    return { rows: autoTableRows, errors: [] };
  }

  if (gameTheme === "memory_card" || gameTheme === "matching_column") {
    let rowNo = 1;
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const cleanLine = line.startsWith("-") ? line.substring(1).trim() : line;
      const delimiter = cleanLine.includes("->") ? "->" : cleanLine.includes("=") ? "=" : null;
      if (!delimiter) continue;

      const [left, right] = cleanLine.split(delimiter).map((s) => s.trim());
      if (left && right) {
        rows.push({
          no: rowNo++,
          question: left,
          options: { A: right, B: "Pilihan B", C: "Pilihan C", D: "Pilihan D" },
          correctOptionKey: "A",
          topic: gameTheme === "memory_card" ? "Pasangan Memori" : "Matching Column",
          difficulty: "medium",
          hasMedia: false,
          mediaType: null,
          mediaFilename: null,
          maxPlayCount: null,
          explanation: null,
        });
      }
    }
    if (rows.length === 0) {
      errors.push("Tidak ada pasangan kata yang terdeteksi (Format: Kata Arab = Terjemahan)");
    }
    return { rows, errors };
  }

  if (gameTheme === "wordle" || gameTheme === "scramble" || gameTheme === "hangman" || gameTheme === "wheel_fortune") {
    let rowNo = 1;
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const cleanLine = line.startsWith("-") ? line.substring(1).trim() : line;

      let word = "";
      let hint = "";

      if (cleanLine.toLowerCase().startsWith("kata:") || cleanLine.toLowerCase().startsWith("frasa:")) {
        const afterPrefix = cleanLine.substring(cleanLine.indexOf(":") + 1).trim();
        const hintMatch = afterPrefix.match(/(.+)\((?:Petunjuk|Clue):\s*(.+)\)/i);
        if (hintMatch) {
          word = hintMatch[1].trim();
          hint = hintMatch[2].trim();
        } else {
          word = afterPrefix;
          hint = `Tebak ${gameTheme}`;
        }
      }

      if (word) {
        rows.push({
          no: rowNo++,
          question: hint || word,
          options: { A: word, B: "Pilihan B", C: "Pilihan C", D: "Pilihan D" },
          correctOptionKey: "A",
          topic: gameTheme.toUpperCase(),
          difficulty: "easy",
          hasMedia: false,
          mediaType: null,
          mediaFilename: null,
          maxPlayCount: null,
          explanation: null,
        });
      }
    }
    if (rows.length === 0) {
      errors.push("Tidak ada kata/frasa yang terdeteksi (Format: - Kata: KataArab (Petunjuk: Clue))");
    }
    return { rows, errors };
  }

  if (gameTheme === "whack_mole") {
    let target = "Whack-a-Mole";
    let correctList: string[] = [];
    let incorrectList: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith("target:")) {
        target = line.substring(7).trim();
      } else if (line.toLowerCase().includes("benar:")) {
        const raw = line.substring(line.indexOf(":") + 1);
        correctList = raw.split(",").map((s) => s.trim()).filter(Boolean);
      } else if (line.toLowerCase().includes("salah:")) {
        const raw = line.substring(line.indexOf(":") + 1);
        incorrectList = raw.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    if (correctList.length > 0) {
      correctList.forEach((corr, idx) => {
        const wrong1 = incorrectList[idx % incorrectList.length] || "Salah 1";
        const wrong2 = incorrectList[(idx + 1) % incorrectList.length] || "Salah 2";
        const wrong3 = incorrectList[(idx + 2) % incorrectList.length] || "Salah 3";

        rows.push({
          no: idx + 1,
          question: `Pukul Tikus Target: ${target}`,
          options: { A: corr, B: wrong1, C: wrong2, D: wrong3 },
          correctOptionKey: "A",
          topic: target,
          difficulty: "easy",
          hasMedia: false,
          mediaType: null,
          mediaFilename: null,
          maxPlayCount: null,
          explanation: null,
        });
      });
    } else {
      errors.push("Format Whack-a-Mole wajib mengisi 'Target:', '- Benar:', dan '- Salah:'");
    }
    return { rows, errors };
  }

  // Standard MCQ Parsing (Kahoot, Millionaire, Jeopardy)
  let currentTopic = "Umum";
  let currentQuestion = "";
  let currentOptions: { A: string; B: string; C: string; D: string } = { A: "", B: "", C: "", D: "" };
  let currentCorrect: "A" | "B" | "C" | "D" = "A";
  let rowNo = 1;

  function commitQuestion() {
    if (currentQuestion && (currentOptions.A || currentOptions.B)) {
      rows.push({
        no: rowNo++,
        question: currentQuestion,
        options: {
          A: currentOptions.A || "Pilihan A",
          B: currentOptions.B || "Pilihan B",
          C: currentOptions.C || "Pilihan C",
          D: currentOptions.D || "Pilihan D",
        },
        correctOptionKey: currentCorrect,
        topic: currentTopic,
        difficulty: "easy",
        hasMedia: false,
        mediaType: null,
        mediaFilename: null,
        maxPlayCount: null,
        explanation: null,
      });
    }
    currentQuestion = "";
    currentOptions = { A: "", B: "", C: "", D: "" };
    currentCorrect = "A";
  }

  for (const line of lines) {
    if (line.startsWith("## Kategori:")) {
      commitQuestion();
      currentTopic = line.replace("## Kategori:", "").trim();
      continue;
    }

    if (line.startsWith("# Soal") || line.startsWith("###") || (line.startsWith("#") && !line.startsWith("##"))) {
      commitQuestion();
      currentQuestion = line.replace(/^#+\s*/, "").replace(/^Soal\s*\d+:\s*/i, "").trim();
      continue;
    }

    const optionMatch = line.match(/^[-*]?\s*([A-D])[\.\)]\s*(.+)/i);
    if (optionMatch && currentQuestion) {
      const key = optionMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
      let text = optionMatch[2].trim();
      const isCorrect = text.includes("[x]") || text.includes("*") || text.toLowerCase().includes("(benar)");
      text = text.replace(/\[x\]|\*|\(benar\)/gi, "").trim();

      currentOptions[key] = text;
      if (isCorrect) currentCorrect = key;
    }
  }
  commitQuestion();

  if (rows.length === 0) {
    errors.push("Tidak dapat menemukan format soal MCQ yang valid dalam teks Markdown.");
  }

  return { rows, errors };
}
