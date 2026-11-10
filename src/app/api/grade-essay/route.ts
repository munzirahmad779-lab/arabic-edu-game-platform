import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentSession } from "@/lib/student-auth";

// Rantai model yang sama dengan route ai-generate asesmen:
// gemini-2.5-flash sudah tidak tersedia bagi pengguna baru (API
// menjawab 404 NOT_FOUND), jadi mulai dari 3.8 dan turun bila model
// tidak tersedia untuk kunci ini.
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash"];
const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

type GradeRequest = {
  submission_id: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "GEMINI_API_KEY belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as GradeRequest;
    const submissionId = body.submission_id;
    if (!submissionId) {
      return NextResponse.json(
        { ok: false, message: "submission_id wajib diisi" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Baca dan tulis basis data lewat klien service-role (jalur server
    // tepercaya). Klien sesi di atas TIDAK bisa dipakai untuk tabel
    // essay_submissions pada alur siswa: siswa bukan pengguna auth
    // Supabase, jadi peran klien sesi untuk mereka adalah anon, dan
    // tabel ini hanya memberi grant ke authenticated dengan policy
    // khusus guru (0054). Akibatnya baca/tulis lewat klien sesi selalu
    // ditolak 42501 untuk siswa dan penilaian tidak pernah terjadi.
    // Wewenang pemanggil tetap diperiksa di bawah SEBELUM Gemini
    // dipanggil dan sebelum apa pun ditulis; klien service hanya
    // bekerja sesudah gerbang itu.
    let service;
    try {
      service = createServiceClient();
    } catch (cfgErr) {
      console.error("[grade-essay] konfigurasi service:", cfgErr);
      return NextResponse.json(
        {
          ok: false,
          message: "Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY)",
        },
        { status: 500 },
      );
    }

    // Ambil submission + assignment
    const { data: sub, error: subErr } = await service
      .from("essay_submissions")
      .select(
        "id, student_id, answer_text, assignment_id, essay_assignments!inner(teacher_id, question_text, ideal_answer, rubric_content, rubric_grammar, rubric_vocabulary)",
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (subErr || !sub) {
      return NextResponse.json(
        { ok: false, message: "Submission tidak ditemukan" },
        { status: 404 },
      );
    }

    const assignment = (
      sub as unknown as {
        essay_assignments: {
          teacher_id: string;
          question_text: string;
          ideal_answer: string | null;
          rubric_content: number;
          rubric_grammar: number;
          rubric_vocabulary: number;
        };
      }
    ).essay_assignments;

    // Gerbang kepemilikan: hanya guru pemilik tugas ATAU siswa pemilik
    // submission yang boleh memicu penilaian AI berbayar ini. Pemanggil
    // anonim yang hanya tahu submission_id ditolak. Alur sahnya ada dua:
    // essay-player siswa (sesi siswa token, sesudah submit) dan guru
    // pemilik kelas (sesi Supabase).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let authorized = Boolean(user) && assignment.teacher_id === user?.id;
    if (!authorized) {
      const studentSession = await getStudentSession();
      authorized = Boolean(
        studentSession && studentSession.student_id === sub.student_id,
      );
    }
    if (!authorized) {
      return NextResponse.json(
        { ok: false, message: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    const prompt = buildPrompt({
      question: assignment.question_text,
      idealAnswer: assignment.ideal_answer,
      studentAnswer: sub.answer_text,
      rubricContent: assignment.rubric_content,
      rubricGrammar: assignment.rubric_grammar,
      rubricVocabulary: assignment.rubric_vocabulary,
    });

    // Coba model berurutan: kegagalan ketersediaan model (404)
    // turun ke model berikutnya. Galat sesaat 503/429 (lonjakan
    // permintaan di sisi Google, teramati 10 Nov 2026 pada ketiga
    // model sekaligus) diulang pada model yang sama sampai dua
    // kali dengan jeda singkat sebelum turun ke model berikutnya.
    let geminiRes: Response | null = null;
    let usedModel = GEMINI_MODELS[0];
    for (const model of GEMINI_MODELS) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch(geminiUrl(model), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
            },
          }),
        });
        if (res.ok) {
          geminiRes = res;
          usedModel = model;
          break;
        }
        const errText = await res.text();
        console.error(`[grade-essay] gemini error (${model}):`, errText);
        const transient = res.status === 503 || res.status === 429;
        if (!transient || attempt === 3) break;
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
      if (geminiRes) break;
    }

    if (!geminiRes) {
      return NextResponse.json(
        { ok: false, message: "Layanan AI bermasalah" },
        { status: 502 },
      );
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    // Gabung SEMUA potongan teks kandidat pertama: model dapat membagi
    // JSON ke beberapa parts, dan mengambil parts[0] saja membuat
    // JSON.parse gagal pada JSON yang terpotong.
    const rawText = (geminiData.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p?.text ?? "")
      .join("")
      .trim();
    if (!rawText) {
      return NextResponse.json(
        { ok: false, message: "Respons AI kosong" },
        { status: 502 },
      );
    }

    let parsed: {
      score?: unknown;
      feedback?: unknown;
      subscores?: {
        content?: unknown;
        grammar?: unknown;
        vocabulary?: unknown;
      };
    };

    // Buang pagar kode ```json bila model tetap memberikannya, lalu
    // coba parse utuh; cadangan terakhir: ambil objek JSON terluar
    // dari dalam teks.
    const unfenced = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    try {
      parsed = JSON.parse(unfenced);
    } catch {
      const m = unfenced.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json(
          { ok: false, message: "Tidak bisa mem-parsing respons AI" },
          { status: 502 },
        );
      }
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return NextResponse.json(
          { ok: false, message: "Tidak bisa mem-parsing respons AI" },
          { status: 502 },
        );
      }
    }

    // Model kadang mengembalikan angka sebagai string; terima keduanya.
    const num = (v: unknown): number => {
      const n = typeof v === "string" ? Number(v) : (v as number);
      return typeof n === "number" && Number.isFinite(n) ? n : 0;
    };

    const score = Math.max(0, Math.min(100, Math.round(num(parsed.score))));
    const feedback = String(parsed.feedback ?? "").slice(0, 3000);
    const subscores = {
      content: Math.max(0, Math.round(num(parsed.subscores?.content))),
      grammar: Math.max(0, Math.round(num(parsed.subscores?.grammar))),
      vocabulary: Math.max(0, Math.round(num(parsed.subscores?.vocabulary))),
    };

    // Simpan skor lewat RPC student_set_ai_grade pada konteks
    // service_role: itulah jalur tulis yang disediakan migrasi 0084
    // untuk server tepercaya (pola kunci 0066). RPC itu memvalidasi
    // ulang rentang skor terhadap rubrik assignment dan menolak bila
    // guru sudah memberi nilai akhir. p_token dipertahankan demi
    // tanda tangan; sejak 0084 token bukan lagi dasar wewenang dan
    // tidak diperiksa, jadi diisi string kosong. Skor berasal dari
    // panggilan Gemini di server ini, tidak pernah dari pemanggil.
    const { error: updErr } = await service.rpc("student_set_ai_grade", {
      p_token: "",
      p_submission_id: submissionId,
      p_ai_score: score,
      p_ai_feedback: feedback,
      p_ai_scores_json: subscores,
      p_ai_model: usedModel,
    });

    if (updErr) {
      console.error("[grade-essay] simpan skor error:", updErr);
      if (updErr.message?.includes("ALREADY_TEACHER_GRADED")) {
        return NextResponse.json(
          { ok: false, message: "Esai ini sudah dinilai akhir oleh guru" },
          { status: 409 },
        );
      }
      if (updErr.message?.includes("SUBMISSION_NOT_FOUND")) {
        return NextResponse.json(
          { ok: false, message: "Submission tidak ditemukan" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { ok: false, message: "Gagal update database" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      score,
      feedback,
      subscores,
      model: usedModel,
    });
  } catch (err) {
    console.error("[grade-essay] exception:", err);
    return NextResponse.json(
      { ok: false, message: "Kesalahan internal" },
      { status: 500 },
    );
  }
}

function buildPrompt(args: {
  question: string;
  idealAnswer: string | null;
  studentAnswer: string;
  rubricContent: number;
  rubricGrammar: number;
  rubricVocabulary: number;
}): string {
  return `أنت مصحح خبير للغة العربية، تقيّم إجابة طالب في مهمة كتابة.

**السؤال المطروح على الطالب:**
${args.question}

${args.idealAnswer ? `**الإجابة المثالية (مرجع):**\n${args.idealAnswer}\n` : ""}

**إجابة الطالب:**
${args.studentAnswer}

**معايير التقييم (المجموع 100):**
- المحتوى والأفكار: ${args.rubricContent} نقطة
- القواعد النحوية والصرفية: ${args.rubricGrammar} نقطة
- المفردات والأسلوب: ${args.rubricVocabulary} نقطة

**التعليمات:**
1. قيّم الإجابة بموضوعية وعدل. لا تكن قاسيًا جدًا ولا متسامحًا جدًا.
2. اذكر نقاط القوة، ثم نقاط التحسين بشكل محدد (أمثلة من الإجابة إن أمكن).
3. اكتب الملاحظات بالعربية الفصحى المبسطة المناسبة للطالب.
4. إذا كانت الإجابة فارغة أو غير مفهومة، أعطِ 0 نقطة.

**أعد النتيجة بصيغة JSON فقط، بدون أي نص إضافي:**
{
  "score": <رقم من 0 إلى 100>,
  "feedback": "<ملاحظات تفصيلية بالعربية، 3-5 جمل>",
  "subscores": {
    "content": <رقم من 0 إلى ${args.rubricContent}>,
    "grammar": <رقم من 0 إلى ${args.rubricGrammar}>,
    "vocabulary": <رقم من 0 إلى ${args.rubricVocabulary}>
  }
}`;
}