import { NextResponse } from "next/server";

// ============================================================
// ROUTE CONFIG
// ============================================================
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ============================================================
// STRATEGI PROVIDER (UPDATE 4 Okt 2026 - v3)
// ============================================================
// Pelajaran dari log sebelumnya:
// - Gemini 3.8 Flash: paling akurat, tapi LAMBAT & sering timeout.
//   Solusi: naikkan timeout, turunkan maxOutputTokens, matikan thinking.
// - NVIDIA: banyak model EOL + READ TIMEOUT massal. Taruh paling belakang.
// - LLM7: gratis, tapi P95 latency-nya bisa 60 detik. Pakai model spesifik.
//
// URUTAN: Gemini (timeout besar) -> LLM7 (model cepat) -> NVIDIA (cadangan)
// ============================================================

// --- Gemini ---
const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];
// Turunkan dari 65536 -> 8000. Cukup untuk 10-20 soal, jauh lebih cepat.
const GEMINI_MAX_OUTPUT_TOKENS = 8000;

// --- LLM7 ---
const LLM7_URL = "https://api.llm7.io/v1/chat/completions";
// "DeepSeek-V4-Flash-0731" punya latency lebih rendah & stabil.
const LLM7_MODELS = ["DeepSeek-V4-Flash-0731", "default", "fast"];

// --- OpenRouter ---
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = ["deepseek/deepseek-v4-flash:free"];

// --- NVIDIA (cadangan terakhir) ---
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
];

// --- Budget waktu ---
const TOTAL_BUDGET_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

// --- Timeout per attempt (disesuaikan) ---
const TIMEOUT_GEMINI = 30_000; // Dinaikkan dari 20s -> 30s
const TIMEOUT_LLM7 = 15_000;
const TIMEOUT_OPENROUTER = 15_000;
const TIMEOUT_NVIDIA = 12_000;

const JSON_SYSTEM_PROMPT =
  "You are a strict JSON generator. You ALWAYS output valid JSON only, " +
  "without markdown fences, without commentary, without explanation.";

// ============================================================
// TIPE DATA (tidak berubah)
// ============================================================

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

// ============================================================
// UTILITAS (tidak berubah)
// ============================================================

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return "timeout";
    }
    const anyErr = err as Error & { cause?: unknown };
    if (anyErr.cause) {
      const c =
        anyErr.cause instanceof Error
          ? `${anyErr.cause.name}: ${anyErr.cause.message}`
          : String(anyErr.cause);
      return `${err.name}: ${err.message} (cause: ${c})`;
    }
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

type TimedSignal = { signal: AbortSignal; done: () => void };

function startTimeout(ms: number): TimedSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, ms));
  return {
    signal: controller.signal,
    done: () => clearTimeout(timer),
  };
}

function isRetryable(msg: string): boolean {
  return (
    /\b(429|500|502|503|504)\b/.test(msg) ||
    /timeout/i.test(msg) ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg)
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    attempts: number;
    baseDelayMs: number;
    label: string;
    shouldRetry: (msg: string) => boolean;
  },
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = describeError(err);
      const isLast = i >= opts.attempts - 1;
      if (isLast || !opts.shouldRetry(msg)) throw err;
      const delay = opts.baseDelayMs * 2 ** i + Math.floor(Math.random() * 500);
      console.warn(
        `[ai-generate] ${opts.label} retry ${i + 1} dalam ${delay}ms karena: ${msg}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ============================================================
// PEMANGGIL PROVIDER (DIPERBARUI)
// ============================================================

async function callOpenAICompatible(args: {
  url: string;
  model: string;
  apiKey: string;
  prompt: string;
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
  maxTokens?: number;
  extraBody?: Record<string, unknown>;
}): Promise<string> {
  const t = startTimeout(args.timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: args.model,
      messages: [
        { role: "system", content: JSON_SYSTEM_PROMPT },
        { role: "user", content: args.prompt },
      ],
      temperature: 0.4,
      max_tokens: args.maxTokens ?? 8000,
    };
    if (args.extraBody) Object.assign(body, args.extraBody);

    const res = await fetch(args.url, {
      method: "POST",
      signal: t.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
        ...(args.extraHeaders ?? {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${args.model} ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as ChatCompletion;
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) throw new Error(`${args.model}: empty response`);
    return text;
  } finally {
    t.done();
  }
}

async function callGeminiOnce(args: {
  model: string;
  prompt: string;
  apiKey: string;
  timeoutMs: number;
  useThinkingConfig: boolean;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent`;
  const t = startTimeout(args.timeoutMs);
  try {
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      temperature: 0.4,
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    };
    if (args.useThinkingConfig) {
      // thinkingLevel: "low" -> lebih cepat dari default (medium)
      generationConfig.thinkingConfig = { thinkingLevel: "low" };
    }

    const res = await fetch(url, {
      method: "POST",
      signal: t.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": args.apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: args.prompt }] }],
        generationConfig,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Gemini ${args.model} ${res.status}: ${text.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text.trim()) throw new Error(`Gemini ${args.model}: empty response`);
    return text;
  } finally {
    t.done();
  }
}

async function callGemini(args: {
  model: string;
  prompt: string;
  apiKey: string;
  timeoutMs: number;
}): Promise<string> {
  // Coba dengan thinkingConfig dulu
  try {
    return await callGeminiOnce({
      model: args.model,
      prompt: args.prompt,
      apiKey: args.apiKey,
      timeoutMs: args.timeoutMs,
      useThinkingConfig: true,
    });
  } catch (err) {
    const msg = describeError(err);
    // Jika model menolak thinkingConfig dengan error 400, ulangi tanpa itu.
    const isThinkingRejected = /\b400\b/.test(msg) && /thinking/i.test(msg);
    if (!isThinkingRejected) {
      // Jika timeout, langsung coba tanpa thinking untuk lebih cepat.
      if (msg === "timeout") {
        console.warn(
          `[ai-generate] Gemini ${args.model} timeout, coba tanpa thinking...`,
        );
        return await callGeminiOnce({
          model: args.model,
          prompt: args.prompt,
          apiKey: args.apiKey,
          timeoutMs: args.timeoutMs,
          useThinkingConfig: false,
        });
      }
      throw err;
    }
    console.warn(
      `[ai-generate] Gemini ${args.model} tolak thinkingConfig, ulangi tanpa: ${msg}`,
    );
    return await callGeminiOnce({
      model: args.model,
      prompt: args.prompt,
      apiKey: args.apiKey,
      timeoutMs: args.timeoutMs,
      useThinkingConfig: false,
    });
  }
}

// ============================================================
// ORKESTRASI FALLBACK (DIPERBARUI)
// ============================================================

type Attempt = {
  name: string;
  run: (prompt: string, timeoutMs: number) => Promise<string>;
  retryAttempts: number;
  retryBaseMs: number;
};

function buildAttempts(): Attempt[] {
  const list: Attempt[] = [];

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const llm7Key = process.env.LLM7_API_KEY?.trim();
  const openrouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const nvidiaKey = process.env.NVIDIA_API_KEY?.trim();

  // ---------- 1. GEMINI (timeout besar, thinking dimatikan jika timeout) ----------
  if (geminiKey) {
    for (const model of GEMINI_MODELS) {
      list.push({
        name: `gemini:${model}`,
        run: (prompt, timeoutMs) =>
          callGemini({
            model,
            prompt,
            apiKey: geminiKey,
            timeoutMs,
          }),
        // Retry 2x dengan jeda naik. Timeout sudah besar (30s),
        // jadi tidak perlu retry banyak-banyak.
        retryAttempts: 2,
        retryBaseMs: 2000,
      });
    }
  }

  // ---------- 2. LLM7 (model spesifik, latency lebih rendah) ----------
  const llm7KeyToUse = llm7Key && llm7Key.length > 0 ? llm7Key : "unused";
  for (const model of LLM7_MODELS) {
    list.push({
      name: `llm7:${model}`,
      run: (prompt, timeoutMs) =>
        callOpenAICompatible({
          url: LLM7_URL,
          model,
          apiKey: llm7KeyToUse,
          prompt,
          timeoutMs,
        }),
      retryAttempts: 1, // Jangan retry banyak, LLM7 P95 latency bisa 60 detik.
      retryBaseMs: 1000,
    });
  }

  // ---------- 3. OPENROUTER ----------
  if (openrouterKey) {
    for (const model of OPENROUTER_MODELS) {
      list.push({
        name: `openrouter:${model}`,
        run: (prompt, timeoutMs) =>
          callOpenAICompatible({
            url: OPENROUTER_URL,
            model,
            apiKey: openrouterKey,
            prompt,
            timeoutMs,
            extraHeaders: {
              "HTTP-Referer": "https://magguru.web.id",
              "X-Title": "Magguru Assessment Generator",
            },
          }),
        retryAttempts: 1,
        retryBaseMs: 1000,
      });
    }
  }

  // ---------- 4. NVIDIA (cadangan terakhir, sering timeout) ----------
  if (nvidiaKey) {
    for (const model of NVIDIA_MODELS) {
      list.push({
        name: `nvidia:${model}`,
        run: (prompt, timeoutMs) =>
          callOpenAICompatible({
            url: NVIDIA_URL,
            model,
            apiKey: nvidiaKey,
            prompt,
            timeoutMs,
            // Matikan "thinking" supaya respons cepat & tidak timeout.
            extraBody: {
              chat_template_kwargs: {
                enable_thinking: false,
                force_nonempty_content: true,
              },
            },
          }),
        retryAttempts: 1,
        retryBaseMs: 1000,
      });
    }
  }

  return list;
}

async function tryProviders(
  prompt: string,
): Promise<{ raw: string; provider: string }> {
  const attempts = buildAttempts();
  if (attempts.length === 0) {
    throw new Error(
      "Tidak ada API key terpasang. Isi .env.local dengan GEMINI_API_KEY / LLM7_API_KEY / OPENROUTER_API_KEY / NVIDIA_API_KEY.",
    );
  }

  const startedAt = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);
  const errors: string[] = [];

  for (const attempt of attempts) {
    const left = remaining();
    if (left < MIN_REMAINING_MS) {
      errors.push(`${attempt.name}: dilewati (budget waktu habis)`);
      continue;
    }

    // Timeout per attempt = min(timeout default, sisa budget - 2s).
    const baseTimeout =
      attempt.name.startsWith("gemini:")
        ? TIMEOUT_GEMINI
        : attempt.name.startsWith("llm7:")
          ? TIMEOUT_LLM7
          : attempt.name.startsWith("openrouter:")
            ? TIMEOUT_OPENROUTER
            : TIMEOUT_NVIDIA;

    const perAttemptTimeout = Math.min(baseTimeout, left - 2000);
    if (perAttemptTimeout < 3000) {
      errors.push(`${attempt.name}: dilewati (sisa waktu terlalu kecil)`);
      continue;
    }

    try {
      const raw = await withRetry(() => attempt.run(prompt, perAttemptTimeout), {
        attempts: attempt.retryAttempts,
        baseDelayMs: attempt.retryBaseMs,
        label: attempt.name,
        shouldRetry: isRetryable,
      });
      console.log(
        `[ai-generate] sukses via ${attempt.name} dalam ${Date.now() - startedAt}ms`,
      );
      return { raw, provider: attempt.name };
    } catch (err) {
      const msg = describeError(err);
      errors.push(`${attempt.name}: ${msg}`);
      console.warn(`[ai-generate] ${attempt.name} gagal: ${msg}`);
    }
  }

  throw new Error("Semua provider gagal. " + errors.join(" | "));
}

// ============================================================
// UTIL: EKSTRAK JSON (tidak berubah)
// ============================================================

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

// ============================================================
// PROMPT BUILDER (tidak berubah)
// ============================================================

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

// ============================================================
// NORMALISASI HASIL AI (tidak berubah)
// ============================================================

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

// ============================================================
// HANDLER POST (tidak berubah)
// ============================================================

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