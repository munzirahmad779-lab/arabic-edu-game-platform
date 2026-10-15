/**
 * Multi-Provider AI Engine for Magguru
 * Orchestrates Groq, Google Gemini, OpenRouter, and aicutad.id with automatic failover.
 */

export type AIProvider = "auto" | "groq" | "gemini" | "openrouter" | "cutad";

export interface GenerateOptions {
  topic: string;
  count: number;
  difficulty?: "easy" | "medium" | "hard";
  provider?: AIProvider;
}

export interface GenerateResult {
  ok: boolean;
  content: string;
  providerUsed: string;
  modelUsed: string;
  error?: string;
}

const SYSTEM_PROMPT = `Kamu adalah pakar penyusun soal pembelajaran bahasa Arab interaktif untuk platform "Magguru".
Tugasmu adalah membuat soal kuis pilihan ganda dalam format Markdown resmi yang kompatibel dengan engine game arkade (Pesawat Awan, Pukul Tikus, Penjaga Antariksa, Balon Melayang, dan Kahoot Arena).

ATURAN KETAT TATA LETAK & PANJANG TEKS (AGAR TIDAK OVERLAP / TERPOTONG DI SEMUA GAME):
1. Panjang Pertanyaan:
   - Maksimal 8-15 kata (tidak lebih dari 75 karakter).
   - Langsung ke inti pertanyaan agar muat di panggung banner game.
2. Panjang Pilihan Jawaban (A, B, C, D):
   - SANGAT PENTING: Maksimal 1-3 KATA per pilihan (maksimal 20 karakter).
   - Alasan: Jawaban akan dirender di dalam awan terbang, balon melayang, asteroid, dan kartu flip.
3. Jumlah Pilihan:
   - Tepat 4 pilihan (A, B, C, D).
4. Penanda Jawaban Benar:
   - Berikan tanda [x] di samping pilihan yang benar.
5. Variasi Jawaban Benar:
   - Acak posisi [x] secara seimbang di antara A, B, C, dan D.
6. Teks Arab:
   - Tulis teks Arab dengan harakat yang jelas dan benar.

FORMAT OUTPUT WAJIB (HANYA FORMAT INI TANPA PENJELASAN LAIN):
# Soal 1: [Pertanyaan]
- A. [Pilihan A]
- B. [Pilihan B] [x]
- C. [Pilihan C]
- D. [Pilihan D]

# Soal 2: [Pertanyaan]
- A. [Pilihan A] [x]
- B. [Pilihan B]
- C. [Pilihan C]
- D. [Pilihan D]
`;

async function callGroq(userPrompt: string): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY tidak dikonfigurasi");

  const models = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "allam-2-7b"];
  let lastErr = "";

  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return { text: content, model };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : "Network error";
    }
  }

  throw new Error(`Groq failed: ${lastErr}`);
}

async function callGemini(userPrompt: string): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY tidak dikonfigurasi");

  const models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-1.5-flash"];
  let lastErr = "";

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text, model };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : "Network error";
    }
  }

  throw new Error(`Gemini failed: ${lastErr}`);
}

async function callOpenRouter(userPrompt: string): Promise<{ text: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY tidak dikonfigurasi");

  const models = ["nvidia/nemotron-3.5-lightning:free", "deepseek/deepseek-r1:free"];
  let lastErr = "";

  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://magguru.id",
          "X-Title": "Magguru Arabic Platform",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return { text: content, model };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : "Network error";
    }
  }

  throw new Error(`OpenRouter failed: ${lastErr}`);
}

async function callCutad(userPrompt: string): Promise<{ text: string; model: string }> {
  const apiKey = process.env.CUTAD_API_KEY;
  if (!apiKey) throw new Error("CUTAD_API_KEY tidak dikonfigurasi");

  const models = ["deepseek-v4-pro", "glm-5.3-flash", "qwen3.8-max"];
  let lastErr = "";

  for (const model of models) {
    try {
      const res = await fetch("https://ai.cutad.web.id/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastErr = errJson?.error?.message || `HTTP ${res.status}`;
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return { text: content, model };
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : "Network error";
    }
  }

  throw new Error(`aicutad failed: ${lastErr}`);
}

export async function generateQuestions(opts: GenerateOptions): Promise<GenerateResult> {
  const userPrompt = `Buatkan ${opts.count} soal kuis bahasa Arab untuk topik "${opts.topic}" dengan tingkat kesulitan "${opts.difficulty || "medium"}".`;
  const provider = opts.provider || "auto";

  // If specific provider selected:
  if (provider === "groq") {
    try {
      const { text, model } = await callGroq(userPrompt);
      return { ok: true, content: text, providerUsed: "Groq", modelUsed: model };
    } catch (err: unknown) {
      return { ok: false, content: "", providerUsed: "Groq", modelUsed: "", error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (provider === "gemini") {
    try {
      const { text, model } = await callGemini(userPrompt);
      return { ok: true, content: text, providerUsed: "Google Gemini", modelUsed: model };
    } catch (err: unknown) {
      return { ok: false, content: "", providerUsed: "Google Gemini", modelUsed: "", error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (provider === "openrouter") {
    try {
      const { text, model } = await callOpenRouter(userPrompt);
      return { ok: true, content: text, providerUsed: "OpenRouter", modelUsed: model };
    } catch (err: unknown) {
      return { ok: false, content: "", providerUsed: "OpenRouter", modelUsed: "", error: err instanceof Error ? err.message : String(err) };
    }
  }

  if (provider === "cutad") {
    try {
      const { text, model } = await callCutad(userPrompt);
      return { ok: true, content: text, providerUsed: "aicutad.id", modelUsed: model };
    } catch (err: unknown) {
      return { ok: false, content: "", providerUsed: "aicutad.id", modelUsed: "", error: err instanceof Error ? err.message : String(err) };
    }
  }

  // AUTO FAILOVER SEQUENCE: Groq -> Gemini -> OpenRouter -> aicutad
  const sequence = [
    { name: "Groq", fn: callGroq },
    { name: "Google Gemini", fn: callGemini },
    { name: "OpenRouter", fn: callOpenRouter },
    { name: "aicutad.id", fn: callCutad },
  ];

  const errors: string[] = [];

  for (const item of sequence) {
    try {
      const res = await item.fn(userPrompt);
      return {
        ok: true,
        content: res.text,
        providerUsed: item.name,
        modelUsed: res.model,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${item.name}: ${msg}`);
    }
  }

  return {
    ok: false,
    content: "",
    providerUsed: "None",
    modelUsed: "None",
    error: `Semua AI provider gagal: ${errors.join(" | ")}`,
  };
}
