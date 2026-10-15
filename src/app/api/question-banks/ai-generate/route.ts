import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuestions, type AIProvider } from "@/lib/ai/multi-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const count = typeof body.count === "number" ? Math.max(1, Math.min(20, body.count)) : 5;
    const difficulty = body.difficulty === "easy" || body.difficulty === "hard" ? body.difficulty : "medium";
    const provider: AIProvider = body.provider || "auto";

    if (!topic) {
      return NextResponse.json({ error: "Topik soal wajib diisi." }, { status: 400 });
    }

    const result = await generateQuestions({
      topic,
      count,
      difficulty,
      provider,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Gagal membuat soal dengan AI" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      markdown: result.content,
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Error";
    console.error("[/api/question-banks/ai-generate]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
