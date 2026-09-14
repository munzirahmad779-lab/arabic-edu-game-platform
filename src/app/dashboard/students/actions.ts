"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StudentImportRow } from "@/lib/student/excel";

function getField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function errorCode(message: string) {
  if (message.includes("INVALID_NAME")) return "invalid_name";
  if (message.includes("INVALID_PIN_FORMAT")) return "invalid_pin";
  if (message.includes("CLASS_NOT_FOUND")) return "invalid_class";
  if (message.includes("DUPLICATE_STUDENT")) return "duplicate";
  if (message.includes("STUDENT_NOT_FOUND")) return "student_not_found";
  return "failed";
}

export async function createStudent(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const classId = getField(formData, "class_id");
  const name = getField(formData, "name");
  const pin = getField(formData, "pin");

  if (!classId || !name || !/^\d{4,6}$/.test(pin)) {
    redirect(
      `/dashboard/students?classId=${encodeURIComponent(classId)}&error=invalid`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("create_student", {
    p_class_id: classId,
    p_name: name,
    p_pin: pin,
  });

  if (error) {
    redirect(
      `/dashboard/students?classId=${encodeURIComponent(classId)}&error=${errorCode(
        String(error.message ?? "")
      )}`
    );
  }

  revalidatePath("/dashboard/students");
  redirect(`/dashboard/students?classId=${encodeURIComponent(classId)}&created=1`);
}

export async function resetStudentPin(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const studentId = getField(formData, "student_id");
  const classId = getField(formData, "class_id");
  const pin = getField(formData, "pin");

  if (!studentId || !classId || !/^\d{4,6}$/.test(pin)) {
    redirect(
      `/dashboard/students?classId=${encodeURIComponent(classId)}&error=invalid_pin`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("reset_student_pin", {
    p_student_id: studentId,
    p_pin: pin,
  });

  if (error) {
    redirect(
      `/dashboard/students?classId=${encodeURIComponent(classId)}&error=${errorCode(
        String(error.message ?? "")
      )}`
    );
  }

  revalidatePath("/dashboard/students");
  redirect(`/dashboard/students?classId=${encodeURIComponent(classId)}&updated=1`);
}

export async function deleteStudent(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const studentId = getField(formData, "student_id");
  const classId = getField(formData, "class_id");

  if (!studentId || !classId) {
    redirect("/dashboard/students?error=failed");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("delete_student", {
    p_student_id: studentId,
  });

  if (error) {
    redirect(
      `/dashboard/students?classId=${encodeURIComponent(classId)}&error=${errorCode(
        String(error.message ?? "")
      )}`
    );
  }

  revalidatePath("/dashboard/students");
  redirect(`/dashboard/students?classId=${encodeURIComponent(classId)}&deleted=1`);
}

export async function importStudents(
  classId: string,
  rows: StudentImportRow[],
): Promise<{ ok: true; imported: number } | { ok: false; message: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "انتهت الجلسة. سجّل الدخول مرة أخرى." };
  }

  if (!/^[0-9a-f-]{36}$/i.test(classId)) {
    return { ok: false, message: "الفصل غير صالح." };
  }

  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 200) {
    return { ok: false, message: "عدد الطلاب يجب أن يكون بين 1 و200." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "import_students_to_class",
    {
      p_class_id: classId,
      p_rows: rows,
    },
  );

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("DUPLICATE_STUDENT_IN_FILE")) {
      return {
        ok: false,
        message: "يوجد اسم مكرر داخل الملف. تأكد أن كل اسم فريد.",
      };
    }
    if (msg.includes("DUPLICATE_STUDENT")) {
      return {
        ok: false,
        message:
          "يوجد طالب بنفس الاسم في هذا الفصل. احذف الاسم المكرر من الملف أو من الفصل.",
      };
    }
    if (msg.includes("INVALID_PIN_FORMAT")) {
      return { ok: false, message: "يوجد PIN غير صالح في الملف." };
    }
    if (msg.includes("INVALID_NAME")) {
      return { ok: false, message: "يوجد اسم غير صالح في الملف." };
    }
    if (msg.includes("CLASS_NOT_FOUND")) {
      return { ok: false, message: "الفصل غير موجود." };
    }
    if (msg.includes("FORBIDDEN")) {
      return { ok: false, message: "لا تملك صلاحية على هذا الفصل." };
    }
    return { ok: false, message: msg || "فشل الاستيراد." };
  }

  revalidatePath("/dashboard/students");
  return { ok: true, imported: Number(data) || 0 };
}