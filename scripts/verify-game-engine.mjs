import assert from "node:assert/strict";

// --- SECTION 1: Arabic Grapheme Utilities Verification ---
const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/;

function splitIntoGraphemes(text) {
  if (!text) return [];
  const normalized = text.normalize("NFC");

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });
    const segments = [];
    for (const seg of segmenter.segment(normalized)) {
      if (seg.segment.trim().length > 0) {
        segments.push(seg.segment);
      }
    }
    return segments;
  }

  const result = [];
  const chars = Array.from(normalized);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char.trim().length === 0) continue;
    if (ARABIC_DIACRITICS_REGEX.test(char) && result.length > 0) {
      result[result.length - 1] += char;
    } else {
      result.push(char);
    }
  }
  return result;
}

function normalizeAnswer(text) {
  return (text ?? "").trim().normalize("NFC");
}

function compareAnswers(actual, expected) {
  return normalizeAnswer(actual).toLowerCase() === normalizeAnswer(expected).toLowerCase();
}

console.log("🧪 1. Testing Arabic Grapheme Cluster Segmentation on actual words...");

// Test Word 1: مُعَلِّمٌ (mu'allimun) - 9 codepoints -> 4 grapheme clusters
const word1 = "مُعَلِّمٌ";
const g1 = splitIntoGraphemes(word1);
console.log(`   Word 1: "${word1}" -> Graphemes:`, g1);
assert.equal(g1.length, 4, "مُعَلِّمٌ must produce 4 visual clusters");
assert.equal(g1[0].normalize("NFC"), "مُ".normalize("NFC"));
assert.equal(g1[1].normalize("NFC"), "عَ".normalize("NFC"));
assert.equal(g1[2].normalize("NFC"), "لِّ".normalize("NFC"));
assert.equal(g1[3].normalize("NFC"), "مٌ".normalize("NFC"));

// Test Word 2: مَدْرَسَة (madrasah) - with sukun & fatha
const word2 = "مَدْرَسَة";
const g2 = splitIntoGraphemes(word2);
console.log(`   Word 2: "${word2}" -> Graphemes:`, g2);
assert.equal(g2.length, 5, "مَدْرَسَة must produce 5 visual clusters");
assert.equal(g2[0].normalize("NFC"), "مَ".normalize("NFC"));
assert.equal(g2[1].normalize("NFC"), "دْ".normalize("NFC"));
assert.equal(g2[2].normalize("NFC"), "رَ".normalize("NFC"));
assert.equal(g2[3].normalize("NFC"), "سَ".normalize("NFC"));
assert.equal(g2[4].normalize("NFC"), "ة".normalize("NFC"));

// Test Word 3: السَّلَامُ (as-salaamu) - with shaddah & alif & dammah
const word3 = "السَّلَامُ";
const g3 = splitIntoGraphemes(word3);
console.log(`   Word 3: "${word3}" -> Graphemes:`, g3);
assert.ok(g3.length >= 5, "السَّلَامُ graphemes must preserve shaddah on Seen");
const seenCluster = g3.find((c) => c.startsWith("س"));
assert.ok(seenCluster && seenCluster.includes("ّ"), "Seen must have shaddah attached");

// Test Word 4: مُدَرِّس (mudarris) - with dammah, fatha, shaddah + kasra
const word4 = "مُدَرِّس";
const g4 = splitIntoGraphemes(word4);
console.log(`   Word 4: "${word4}" -> Graphemes:`, g4);
assert.equal(g4.length, 4, "مُدَرِّس must produce 4 visual clusters");
assert.equal(g4[0].normalize("NFC"), "مُ".normalize("NFC"));
assert.equal(g4[1].normalize("NFC"), "دَ".normalize("NFC"));
assert.equal(g4[2].normalize("NFC"), "رِّ".normalize("NFC"));
assert.equal(g4[3].normalize("NFC"), "س".normalize("NFC"));

// Test normalization & equivalence
assert.ok(compareAnswers(" كِتَابٌ ", "كِتَابٌ"));
assert.ok(compareAnswers("مَدْرَسَة", "مَدْرَسَة".normalize("NFD")));
console.log("   ✅ All 4 Arabic words tested: Grapheme clusters and combining marks 100% verified!");

// --- SECTION 2: Game Engine Registry Verification ---
console.log("\n🧪 2. Testing Game Registry Resolution & Accurate Capabilities...");

const REGISTRY_MAP = {
  runner: {
    id: "runner",
    name: "Arabic Sprint Runner",
    supportedModes: ["competitive", "practice"],
    capabilities: { supportsLanes: true, supportsPowerups: true },
  },
  matching: {
    id: "matching",
    name: "Word & Meaning Matcher",
    supportedModes: ["competitive", "practice"],
    capabilities: { supportsPairMatching: true, supportsFlipAnimation: true },
  },
  penalty: {
    id: "penalty",
    name: "Penalty Shootout Challenge",
    supportedModes: ["competitive", "practice"],
    capabilities: { supportsTargetCorners: true, supportsGoalkeeperAi: true },
  },
  quiz: {
    id: "quiz",
    name: "Classic Arabic Quiz",
    supportedModes: ["competitive", "cooperative", "practice", "endless"],
    capabilities: { supportsMediaAudio: true, supportsMediaImage: true },
  },
  anagram: {
    id: "anagram",
    name: "Arabic Anagram Scramble",
    supportedModes: ["competitive", "practice"],
    capabilities: { supportsGraphemeTiles: true, supportsServerValidation: true },
  },
};

const LEGACY_ALIASES = {
  arabic_chase_race: "runner",
  classic: "quiz",
  survival: "quiz",
  speed_run: "runner",
};

function resolveGameType(input) {
  if (!input) return "quiz";
  const clean = input.trim().toLowerCase();
  if (clean in REGISTRY_MAP) return clean;
  if (clean in LEGACY_ALIASES) return LEGACY_ALIASES[clean];
  return "quiz";
}

function isModeSupported(type, mode) {
  const def = REGISTRY_MAP[type];
  return def ? def.supportedModes.includes(mode) : false;
}

assert.equal(resolveGameType("runner"), "runner");
assert.equal(resolveGameType("matching"), "matching");
assert.equal(resolveGameType("penalty"), "penalty");
assert.equal(resolveGameType("anagram"), "anagram");
assert.equal(resolveGameType("quiz"), "quiz");
assert.equal(resolveGameType("arabic_chase_race"), "runner");
assert.equal(resolveGameType("classic"), "quiz");
assert.equal(resolveGameType("survival"), "quiz");
assert.equal(resolveGameType("unknown_mode_xyz"), "quiz");

// Verify false capability prevention
assert.equal(isModeSupported("runner", "endless"), false, "Runner must not falsely claim endless mode");
assert.equal(isModeSupported("runner", "cooperative"), false, "Runner must not falsely claim cooperative mode");
assert.equal(isModeSupported("penalty", "cooperative"), false, "Penalty must not falsely claim cooperative mode");
assert.equal(isModeSupported("quiz", "cooperative"), true, "Quiz legitimately supports cooperative mode");
assert.equal(isModeSupported("runner", "competitive"), true);
console.log("   ✅ Registry resolution and capability checks verified: No false capabilities!");

// --- SECTION 3: Question Adapters Verification ---
console.log("\n🧪 3. Testing Question Adapters...");

// 3A. Runner Adapter
function toRunner(q) {
  const lanes = (q.options || []).slice(0, 4).map((opt, idx) => ({
    laneIndex: idx,
    laneLabel: ["A", "B", "C", "D"][idx] || `${idx + 1}`,
    optionId: opt.id,
    optionText: opt.option_text,
    isTarget: opt.option_key === q.correct_option_key,
  }));
  return {
    id: q.id,
    questionText: q.question_text,
    lanes,
    targetLaneIndex: lanes.findIndex((l) => l.isTarget),
  };
}

const mockMcqQuestion = {
  id: "q-101",
  question_text: "ما معنى كَلِمَة (قَلَمٌ)؟",
  correct_option_key: "A",
  options: [
    { id: "opt-1", option_key: "A", option_text: "Pena / Pulpen" },
    { id: "opt-2", option_key: "B", option_text: "Buku Tulis" },
    { id: "opt-3", option_key: "C", option_text: "Penghapus" },
    { id: "opt-4", option_key: "D", option_text: "Penggaris" },
  ],
};

const runnerAdapted = toRunner(mockMcqQuestion);
assert.equal(runnerAdapted.lanes.length, 4, "Runner must have 4 lanes");
assert.equal(runnerAdapted.targetLaneIndex, 0);
assert.equal(runnerAdapted.lanes[0].isTarget, true);
console.log("   ✅ Runner adapter verified!");

// 3B. Matching Adapter (Intelligent Delimiter & Semantic Target Matching)
function toMatching(raw) {
  const cards = [];
  const correctOpt = raw.options.find((o) => o.option_key === raw.correct_option_key) ?? raw.options[0];
  const correctOptionId = correctOpt.id;
  const delimiterRegex = /\s*[:=—]\s*|\s+-\s+/;
  const delimitedOptions = raw.options.filter((opt) => delimiterRegex.test(opt.option_text));

  let targetPairsCount = 1;

  if (delimitedOptions.length >= 2) {
    delimitedOptions.forEach((opt) => {
      const parts = opt.option_text.split(delimiterRegex);
      const left = parts[0]?.trim() || opt.option_text;
      const right = parts.slice(1).join(" : ").trim() || opt.option_text;
      const pairId = `pair_${opt.id}`;
      cards.push({ id: `prompt_${opt.id}`, pairId, text: left, role: "prompt" });
      cards.push({ id: `target_${opt.id}`, pairId, text: right, role: "target" });
    });
    targetPairsCount = delimitedOptions.length;
  } else {
    const quoteMatch = raw.question_text.match(/\(([^)]+)\)|"([^"]+)"|'([^']+)'|«([^»]+)»/);
    const arabicMatch = raw.question_text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+)*/);
    const promptText = (quoteMatch?.[1] || quoteMatch?.[2] || arabicMatch?.[0] || raw.question_text).trim();
    const pairId = `pair_${correctOptionId}`;

    cards.push({ id: `prompt_${raw.id}`, pairId, text: promptText, role: "prompt" });
    raw.options.forEach((opt) => {
      const isCorrect = opt.id === correctOptionId;
      cards.push({
        id: `target_${opt.id}`,
        pairId: isCorrect ? pairId : `decoy_${opt.id}`,
        text: opt.option_text,
        role: "target",
      });
    });
    targetPairsCount = 1;
  }

  return {
    id: raw.id,
    title: raw.question_text,
    cards,
    targetPairsCount,
    correctOptionId,
  };
}

// Test Case 1: Vocabulary question with delimiters (Authentic Multi-Pair Matching)
const mockVocabularyPairsQuestion = {
  id: "q-201",
  question_text: "Jodohkan kosakata bahasa Arab berikut:",
  correct_option_key: "A",
  options: [
    { id: "opt-v1", option_key: "A", option_text: "كِتَابٌ : Buku" },
    { id: "opt-v2", option_key: "B", option_text: "قَلَمٌ : Pena" },
    { id: "opt-v3", option_key: "C", option_text: "بَيْتٌ : Rumah" },
    { id: "opt-v4", option_key: "D", option_text: "مَدْرَسَةٌ : Sekolah" },
  ],
};

const vocabMatching = toMatching(mockVocabularyPairsQuestion);
assert.equal(vocabMatching.cards.length, 8, "Must produce 8 cards (4 pairs)");
assert.equal(vocabMatching.targetPairsCount, 4, "Must have 4 target pairs");
// Check that Arabic terms and Indonesian meanings are paired:
const bookPrompt = vocabMatching.cards.find((c) => c.text === "كِتَابٌ");
const bookTarget = vocabMatching.cards.find((c) => c.text === "Buku");
assert.ok(bookPrompt && bookTarget, "كِتَابٌ and Buku must be separate cards");
assert.equal(bookPrompt.pairId, bookTarget.pairId, "كِتَابٌ and Buku must share the same pairId");
console.log("   ✅ Matching with delimiters verified: Genuine Arabic-Indonesian word pairs!");

// Test Case 2: Standard MCQ without delimiters (Semantic Target Extraction with Decoys)
const mcqMatching = toMatching(mockMcqQuestion);
assert.equal(mcqMatching.targetPairsCount, 1, "Standard MCQ matching has 1 target pair");
const qalamPrompt = mcqMatching.cards.find((c) => c.text === "قَلَمٌ");
const penaTarget = mcqMatching.cards.find((c) => c.text === "Pena / Pulpen");
const bukuDecoy = mcqMatching.cards.find((c) => c.text === "Buku Tulis");
assert.ok(qalamPrompt && penaTarget && bukuDecoy);
assert.equal(qalamPrompt.pairId, penaTarget.pairId, "Target word matches correct option");
assert.notEqual(qalamPrompt.pairId, bukuDecoy.pairId, "Decoy distractor must NOT match target word");
console.log("   ✅ Matching with standard MCQ verified: Target word matches only the correct answer!");

console.log("\n==========================================");
console.log("🎉 ALL VALIDATION & INTEGRITY TESTS PASSED!");
console.log("==========================================");
