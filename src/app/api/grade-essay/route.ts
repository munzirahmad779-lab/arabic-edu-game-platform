import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type GradeRequest = {
  submission_id: string;
};

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "GEMINI_API_KEY not configured" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as GradeRequest;
    const submissionId = body.submission_id;
    if (!submissionId) {
      return NextResponse.json(
        { ok: false, message: "submission_id required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Ambil submission + assignment
    const { data: sub, error: subErr } = await supabase
      .from("essay_submissions")
      .select(
        "id, answer_text, assignment_id, essay_assignments!inner(question_text, ideal_answer, rubric_content, rubric_grammar, rubric_vocabulary)",
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (subErr || !sub) {
      return NextResponse.json(
        { ok: false, message: "submission not found" },
        { status: 404 },
      );
    }

    const assignment = (
      sub as unknown as {
        essay_assignments: {
          question_text: string;
          ideal_answer: string | null;
          rubric_content: number;
          rubric_grammar: number;
          rubric_vocabulary: number;
        };
      }
    ).essay_assignments;

    const prompt = buildPrompt({
      question: assignment.question_text,
      idealAnswer: assignment.ideal_answer,
      studentAnswer: sub.answer_text,
      rubricContent: assignment.rubric_content,
      rubricGrammar: assignment.rubric_grammar,
      rubricVocabulary: assignment.rubric_vocabulary,
    });

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[grade-essay] gemini error:", errText);
      return NextResponse.json(
        { ok: false, message: "AI service error", detail: errText.slice(0, 500) },
        { status: 502 },
      );
    }

    const geminiData = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText) {
      return NextResponse.json(
        { ok: false, message: "Empty AI response" },
        { status: 502 },
      );
    }

    let parsed: {
      score: number;
      feedback: string;
      subscores: { content: number; grammar: number; vocabulary: number };
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fallback: cari JSON di dalam teks
      const m = rawText.match(/\{[\s\S]*\}/);
      if (!m) {
        return NextResponse.json(
          { ok: false, message: "Cannot parse AI response" },
          { status: 502 },
        );
      }
      parsed = JSON.parse(m[0]);
    }

    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
    const feedback = String(parsed.feedback ?? "").slice(0, 3000);
    const subscores = {
      content: Math.max(0, Math.round(parsed.subscores?.content ?? 0)),
      grammar: Math.max(0, Math.round(parsed.subscores?.grammar ?? 0)),
      vocabulary: Math.max(0, Math.round(parsed.subscores?.vocabulary ?? 0)),
    };

    // Simpan ke DB via update langsung (server client = auth guru/siswa)
    const { error: updErr } = await supabase
      .from("essay_submissions")
      .update({
        ai_score: score,
        ai_feedback: feedback,
        ai_scores_json: subscores,
        ai_model: GEMINI_MODEL,
        graded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updErr) {
      console.error("[grade-essay] update error:", updErr);
      return NextResponse.json(
        { ok: false, message: "DB update failed", detail: updErr.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      score,
      feedback,
      subscores,
      model: GEMINI_MODEL,
    });
  } catch (err) {
    console.error("[grade-essay] exception:", err);
    return NextResponse.json(
      { ok: false, message: "Internal error" },
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