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

console.log("🧪 1. Testing Arabic Grapheme Cluster Segmentation...");
// Test case: مُعَلِّمٌ (mu'allim)
// Base letters: م, ع, ل, م
// Diacritics: ُ (damma), َ (fatha), ّ (shaddah) + ِ (kasra), ٌ (tanwin damma)
const testWord1 = "مُعَلِّمٌ";
const graphemes1 = splitIntoGraphemes(testWord1);
console.log(`   Word: "${testWord1}" -> Graphemes:`, graphemes1);

// Naive split would have produced 9 separate Unicode code points:
const naiveSplit = Array.from(testWord1);
assert.equal(naiveSplit.length, 9, "Naive split should have 9 raw code units/chars");
// Grapheme split should produce exactly 4 clusters:
assert.equal(graphemes1.length, 4, "Grapheme split must produce 4 visual clusters");
assert.equal(graphemes1[0].normalize("NFC"), "مُ".normalize("NFC"), "Cluster 0 must be Meem with Damma");
assert.equal(graphemes1[1].normalize("NFC"), "عَ".normalize("NFC"), "Cluster 1 must be Ayn with Fatha");
assert.equal(graphemes1[2].normalize("NFC"), "لِّ".normalize("NFC"), "Cluster 2 must be Lam with Shaddah and Kasrah");
assert.equal(graphemes1[3].normalize("NFC"), "مٌ".normalize("NFC"), "Cluster 3 must be Meem with Tanwin Damma");
console.log("   ✅ Arabic grapheme clustering passed: No combining marks detached!");

// Test case: normalization & answer comparison
assert.ok(compareAnswers(" كِتَابٌ ", "كِتَابٌ"));
assert.ok(compareAnswers("مَدْرَسَة", "مَدْرَسَة".normalize("NFD"))); // NFC normalization matches
console.log("   ✅ Arabic normalization passed!");

// --- SECTION 2: Game Engine Registry Verification ---
console.log("\n🧪 2. Testing Game Registry Resolution & Contracts...");

const REGISTRY_MAP = {
  runner: {
    id: "runner",
    name: "Arabic Sprint Runner",
    supportedModes: ["competitive", "practice", "endless"],
    capabilities: { supportsLanes: true, supportsPowerups: true },
  },
  matching: {
    id: "matching",
    name: "Word & Meaning Matcher",
    supportedModes: ["competitive", "practice", "learning"],
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
    supportedModes: ["competitive", "practice", "learning", "endless"],
    capabilities: { supportsMediaAudio: true, supportsMediaImage: true },
  },
  anagram: {
    id: "anagram",
    name: "Arabic Anagram Scramble",
    supportedModes: ["competitive", "practice", "learning"],
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

assert.equal(resolveGameType("runner"), "runner");
assert.equal(resolveGameType("matching"), "matching");
assert.equal(resolveGameType("penalty"), "penalty");
assert.equal(resolveGameType("anagram"), "anagram");
assert.equal(resolveGameType("quiz"), "quiz");
assert.equal(resolveGameType("arabic_chase_race"), "runner");
assert.equal(resolveGameType("classic"), "quiz");
assert.equal(resolveGameType("survival"), "quiz");
assert.equal(resolveGameType("unknown_mode_xyz"), "quiz");
console.log("   ✅ Registry resolution passed: 100% alias & fallback accuracy!");

// --- SECTION 3: Question Adapters Verification ---
console.log("\n🧪 3. Testing Question Adapters...");

const mockRawQuestion = {
  id: "q-101",
  question_text: "ما معنى كَلِمَة (قَلَمٌ)؟",
  question_type: "multiple_choice",
  media_url: null,
  media_type: null,
  explanation: "Qalamun artinya pena/pulpen",
  difficulty: "medium",
  category: "Mufradat",
  options: [
    { id: "opt-1", text: "Pena / Pulpen", is_correct: true },
    { id: "opt-2", text: "Buku Tulis", is_correct: false },
    { id: "opt-3", text: "Penghapus", is_correct: false },
    { id: "opt-4", text: "Penggaris", is_correct: false },
  ],
};

// Runner adapter logic
function toRunner(q) {
  const lanes = (q.options || []).slice(0, 4).map((opt, idx) => ({
    laneIndex: idx,
    laneLabel: ["A", "B", "C", "D"][idx] || `${idx + 1}`,
    optionId: opt.id,
    optionText: opt.text,
    isTarget: Boolean(opt.is_correct),
  }));
  return {
    id: q.id,
    questionText: q.question_text,
    lanes,
    targetLaneIndex: lanes.findIndex((l) => l.isTarget),
  };
}

const runnerAdapted = toRunner(mockRawQuestion);
assert.equal(runnerAdapted.lanes.length, 4, "Runner must have 4 lanes");
assert.equal(runnerAdapted.targetLaneIndex, 0, "Target lane index should be 0");
assert.equal(runnerAdapted.lanes[0].isTarget, true);
assert.equal(runnerAdapted.lanes[1].isTarget, false);
console.log("   ✅ Runner adapter verified!");

// Matching adapter logic
function toMatching(q) {
  const pairs = (q.options || []).slice(0, 6).map((opt, idx) => ({
    id: `pair-${idx}`,
    leftId: `left-${opt.id}`,
    leftText: opt.text,
    rightId: `right-${opt.id}`,
    rightText: opt.is_correct ? "Jawaban Benar" : `Pilihan ${idx + 1}`,
    optionId: opt.id,
  }));
  return {
    id: q.id,
    prompt: q.question_text,
    pairs,
  };
}

const matchingAdapted = toMatching(mockRawQuestion);
assert.equal(matchingAdapted.pairs.length, 4, "Matching must have 4 pairs");
assert.equal(matchingAdapted.pairs[0].leftId, "left-opt-1");
console.log("   ✅ Matching adapter verified!");

// Penalty adapter logic
function toPenalty(q) {
  const corners = ["top_left", "top_right", "bottom_left", "bottom_right"];
  const targets = (q.options || []).slice(0, 4).map((opt, idx) => ({
    corner: corners[idx] || "bottom_right",
    optionId: opt.id,
    optionText: opt.text,
    isGoal: Boolean(opt.is_correct),
  }));
  return {
    id: q.id,
    questionText: q.question_text,
    targets,
    targetCorner: targets.find((t) => t.isGoal)?.corner || "top_left",
  };
}

const penaltyAdapted = toPenalty(mockRawQuestion);
assert.equal(penaltyAdapted.targets.length, 4, "Penalty must have 4 corners");
assert.equal(penaltyAdapted.targetCorner, "top_left");
assert.equal(penaltyAdapted.targets[0].isGoal, true);
console.log("   ✅ Penalty adapter verified!");

console.log("\n==========================================");
console.log("🎉 ALL GAME ENGINE SPECIFICATION TESTS PASSED!");
console.log("==========================================");
