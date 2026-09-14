"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  // Update pin_plain juga (kalau kolomnya ada)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("students")
    .update({ pin_plain: pin })
    .eq("id", studentId)
    .eq("class_id", classId);

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
  names: string[],
): Promise<
  | { ok: true; students: { student_name: string; student_pin: string }[] }
  | { ok: false; message: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sesi berakhir. Silakan login kembali." };
  }

  if (!/^[0-9a-f-]{36}$/i.test(classId)) {
    return { ok: false, message: "Kelas tidak valid." };
  }

  if (!Array.isArray(names) || names.length < 1 || names.length > 200) {
    return { ok: false, message: "Jumlah siswa harus antara 1 dan 200." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "import_students_to_class",
    {
      p_class_id: classId,
      p_names: names,
    },
  );

  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("DUPLICATE_STUDENT_IN_FILE")) {
      return {
        ok: false,
        message: "Ada nama yang sama di dalam daftar. Pastikan setiap nama unik.",
      };
    }
    if (msg.includes("DUPLICATE_STUDENT")) {
      return {
        ok: false,
        message:
          "Ada siswa dengan nama yang sama di kelas ini. Hapus nama duplikat dari daftar.",
      };
    }
    if (msg.includes("INVALID_NAME")) {
      return { ok: false, message: "Ada nama yang tidak valid di daftar." };
    }
    if (msg.includes("CLASS_NOT_FOUND")) {
      return { ok: false, message: "Kelas tidak ditemukan." };
    }
    if (msg.includes("FORBIDDEN")) {
      return { ok: false, message: "Anda tidak punya akses ke kelas ini." };
    }
    return { ok: false, message: msg || "Import gagal." };
  }

  revalidatePath("/dashboard/students");

  const list = Array.isArray(data) ? data : [];
  return { ok: true, students: list };
}