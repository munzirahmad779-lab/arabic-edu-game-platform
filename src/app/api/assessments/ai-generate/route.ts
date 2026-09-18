import { NextResponse } from "next/server";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "nvidia/nemotron-3-super-120b-a12b";

const LLM7_URL = "https://api.llm7.io/v1/chat/completions";
const LLM7_MODEL = "default";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "deepseek/deepseek-v4-flash:free";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type SectionType = "listening" | "structure" | "reading";

type QuestionOutput = {
  section_type: SectionType;
  question_number: number;
  passage_ref: string | null;
  audio_ref: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  difficulty: "easy" | "medium" | "hard" | null;
};

type PassageOutput = {
  ref_id: string;
  title: string | null;
  content: string;
};

type AIResult = {
  passages: PassageOutput[];
  questions: QuestionOutput[];
};

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function callOpenAICompatible(
  url: string,
  model: string,
  apiKey: string,
  prompt: string,
  extraHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON generator. You ALWAYS output valid JSON only, without markdown fences, without commentary.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${model} ${res.status}: ${t.slice(0, 200)}`);
  }

  const data = (await res.json()) as ChatCompletion;
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`${model}: empty response`);
  return text;
}

async function callNVIDIA(prompt: string, apiKey: string): Promise<string> {
  return callOpenAICompatible(NVIDIA_URL, NVIDIA_MODEL, apiKey, prompt);
}

async function callLLM7(prompt: string, apiKey: string): Promise<string> {
  return callOpenAICompatible(LLM7_URL, LLM7_MODEL, apiKey, prompt);
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  return callOpenAICompatible(
    OPENROUTER_URL,
    OPENROUTER_MODEL,
    apiKey,
    prompt,
    {
      "HTTP-Referer": "https://magguru.app",
      "X-Title": "Magguru Assessment Generator",
    },
  );
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
        maxOutputTokens: 8000,
      },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini: empty response");
  return text;
}

async function tryProviders(
  prompt: string,
): Promise<{ raw: string; provider: string }> {
  const errors: string[] = [];
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const llm7Key = process.env.LLM7_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const providers: Array<{
    name: string;
    key: string | undefined;
    fn: (p: string, k: string) => Promise<string>;
  }> = [
    { name: "nvidia", key: nvidiaKey, fn: callNVIDIA },
    { name: "llm7", key: llm7Key, fn: callLLM7 },
    { name: "openrouter-deepseek", key: openrouterKey, fn: callOpenRouter },
    { name: "gemini", key: geminiKey, fn: callGemini },
  ];

  for (const p of providers) {
    if (!p.key) continue;
    try {
      const raw = await p.fn(prompt, p.key);
      return { raw, provider: p.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${p.name}: ${msg}`);
      console.warn(`[ai-generate] ${p.name} gagal:`, msg);
    }
  }

  throw new Error(
    "Semua provider gagal. " +
      (errors.length > 0 ? errors.join(" | ") : "Tidak ada API key terpasang."),
  );
}

function extractJson(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  return JSON.parse(cleaned);
}

const SYSTEM_RULES = `Kamu ahli pembuat soal ujian TOEFL ITP dan TOAFL.
Output kamu HARUS JSON valid, tanpa teks lain, tanpa markdown fence.

Skema JSON:
{
  "passages": [
    { "ref_id": "P1", "title": "Judul bacaan", "content": "Isi bacaan lengkap..." }
  ],
  "questions": [
    {
      "section_type": "listening",
      "question_number": 1,
      "passage_ref": null,
      "audio_ref": "A1",
      "question_text": "What does the woman suggest?",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_answer": "A",
      "difficulty": "medium"
    }
  ]
}

ATURAN KETAT:
1. section_type HARUS salah satu: "listening", "structure", "reading".
2. question_number mulai dari 1 dan reset per section.
3. passage_ref HANYA diisi untuk reading (contoh "P1"), selain itu null.
4. audio_ref HANYA diisi untuk listening (contoh "A1"), selain itu null.
5. correct_answer HARUS: "A", "B", "C", atau "D".
6. difficulty HARUS: "easy", "medium", atau "hard".
7. passages: kosongkan [] kalau tidak ada bacaan.
8. JANGAN tambah field di luar skema.
9. JANGAN tambah teks penjelasan di luar JSON.`;

function buildGeneratePrompt(args: {
  section: SectionType;
  count: number;
  topic: string | null;
  difficulty: string;
  language: "arabic" | "english";
}): string {
  const lang =
    args.language === "arabic" ? "Bahasa Arab fusha" : "Bahasa Inggris";
  const sectionInstruction =
    args.section === "reading"
      ? 'Buat 1 bacaan lengkap (4-6 paragraf) lalu soal mengacu ke bacaan itu. Isi array "passages" dengan satu entry ref_id="P1". Semua soal reading di batch ini WAJIB punya passage_ref="P1".'
      : args.section === "listening"
        ? 'Semua soal listening di batch ini WAJIB punya audio_ref="A1". passages kosongkan []. Setiap soal berisi pertanyaan tentang percakapan pendek.'
        : "Section structure: soal melengkapi kalimat atau mencari error. passages kosongkan []. passage_ref=null, audio_ref=null.";

  return `${SYSTEM_RULES}

TUGAS: Buat ${args.count} soal BARU untuk section "${args.section}".
${args.topic ? `TOPIK: ${args.topic}` : "TOPIK: umum, gaya khas TOEFL."}
KESULITAN: ${args.difficulty}
BAHASA SOAL & OPSI: ${lang}
${sectionInstruction}

Kembalikan HANYA JSON.`;
}

function buildStructurePrompt(
  draft: string,
  language: "arabic" | "english",
): string {
  return `${SYSTEM_RULES}

TUGAS: Rapikan draft soal berikut menjadi JSON terstruktur sesuai skema.
BAHASA SOAL: ${language === "arabic" ? "Bahasa Arab" : "Bahasa Inggris"}

DETEKSI OTOMATIS:
- Soal dengan percakapan/dialog/audio → section_type="listening", audio_ref="A1"
- Soal dengan bacaan panjang → section_type="reading", buat entry di "passages"
- Soal melengkapi kalimat / cari error → section_type="structure"

DRAFT SOAL:
"""
${draft}
"""

Kembalikan HANYA JSON.`;
}

function normalizeResult(raw: unknown): AIResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = raw as any;
  const passagesRaw = Array.isArray(obj?.passages) ? obj.passages : [];
  const questionsRaw = Array.isArray(obj?.questions) ? obj.questions : [];

  const passages: PassageOutput[] = [];
  for (const p of passagesRaw) {
    const refId = String(p?.ref_id ?? "").trim();
    const content = String(p?.content ?? "").trim();
    if (!refId || !content) continue;
    passages.push({
      ref_id: refId,
      title: p?.title ? String(p.title) : null,
      content,
    });
  }

  const questions: QuestionOutput[] = [];
  for (const q of questionsRaw) {
    const section = String(q?.section_type ?? "").toLowerCase();
    if (
      section !== "listening" &&
      section !== "structure" &&
      section !== "reading"
    ) {
      continue;
    }
    const ans = String(q?.correct_answer ?? "").toUpperCase();
    if (ans !== "A" && ans !== "B" && ans !== "C" && ans !== "D") continue;
    const num = Number(q?.question_number);
    if (!Number.isFinite(num) || num < 1) continue;
    const qText = String(q?.question_text ?? "").trim();
    const a = String(q?.option_a ?? "").trim();
    const b = String(q?.option_b ?? "").trim();
    const c = String(q?.option_c ?? "").trim();
    const d = String(q?.option_d ?? "").trim();
    if (!qText || !a || !b || !c || !d) continue;

    const diffRaw = String(q?.difficulty ?? "").toLowerCase();
    const difficulty: "easy" | "medium" | "hard" | null =
      diffRaw === "easy" || diffRaw === "medium" || diffRaw === "hard"
        ? (diffRaw as "easy" | "medium" | "hard")
        : null;

    questions.push({
      section_type: section,
      question_number: num,
      passage_ref: q?.passage_ref ? String(q.passage_ref) : null,
      audio_ref: q?.audio_ref ? String(q.audio_ref) : null,
      question_text: qText,
      option_a: a,
      option_b: b,
      option_c: c,
      option_d: d,
      correct_answer: ans as "A" | "B" | "C" | "D",
      difficulty,
    });
  }

  return { passages, questions };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      mode?: string;
      section_type?: string;
      count?: number;
      topic?: string;
      difficulty?: string;
      language?: string;
      draft?: string;
    };

    const mode = body.mode;
    if (mode !== "generate" && mode !== "structure") {
      return NextResponse.json(
        { ok: false, message: "Mode tidak valid" },
        { status: 400 },
      );
    }

    const language: "arabic" | "english" =
      body.language === "arabic" ? "arabic" : "english";

    let prompt: string;
    if (mode === "generate") {
      const section = String(body.section_type ?? "").toLowerCase();
      if (
        section !== "listening" &&
        section !== "structure" &&
        section !== "reading"
      ) {
        return NextResponse.json(
          { ok: false, message: "Section tidak valid" },
          { status: 400 },
        );
      }
      const count = Math.max(1, Math.min(40, Number(body.count) || 10));
      prompt = buildGeneratePrompt({
        section,
        count,
        topic: body.topic ? String(body.topic).slice(0, 300) : null,
        difficulty: String(body.difficulty ?? "medium"),
        language,
      });
    } else {
      const draft = String(body.draft ?? "").trim();
      if (draft.length < 20) {
        return NextResponse.json(
          { ok: false, message: "Draft terlalu pendek (min 20 karakter)" },
          { status: 400 },
        );
      }
      if (draft.length > 15000) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Draft terlalu panjang (maks 15000 karakter). Bagi jadi beberapa bagian.",
          },
          { status: 400 },
        );
      }
      prompt = buildStructurePrompt(draft, language);
    }

    const { raw, provider } = await tryProviders(prompt);

    let parsed: unknown;
    try {
      parsed = extractJson(raw);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message:
            "AI mengembalikan format tidak valid. Coba lagi, atau ubah draft.",
        },
        { status: 502 },
      );
    }

    const result = normalizeResult(parsed);

    if (result.questions.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "AI tidak menghasilkan soal yang valid. Coba lagi atau ubah input.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider,
      passages: result.passages,
      questions: result.questions,
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    console.error("[ai-generate] error:", msg);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}