"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MAX_CLASS_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 100;

function normalizeName(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSubject(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const subject = value.trim();
  return subject === "" ? null : subject;
}

function isValidSubject(subject: string | null) {
  return subject === null || subject.length <= MAX_SUBJECT_LENGTH;
}

export async function createClass(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const name = normalizeName(formData.get("name"));
  const subject = normalizeSubject(formData.get("subject"));

  if (!name || name.length > MAX_CLASS_NAME_LENGTH) {
    redirect("/dashboard/classes?error=invalid_name");
  }

  if (!isValidSubject(subject)) {
    redirect("/dashboard/classes?error=invalid_subject");
  }

  const { error } = await supabase.from("classes").insert({
    teacher_id: user.id,
    name,
    subject,
  });

  if (error) {
    if (error.code === "23505") {
      redirect("/dashboard/classes?error=duplicate");
    }

    redirect("/dashboard/classes?error=create_failed");
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard");
  redirect("/dashboard/classes");
}

export async function updateClass(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const classId = formData.get("id");
  const name = normalizeName(formData.get("name"));
  const subject = normalizeSubject(formData.get("subject"));

  if (
    typeof classId !== "string" ||
    !classId ||
    !name ||
    name.length > MAX_CLASS_NAME_LENGTH
  ) {
    redirect("/dashboard/classes?error=invalid_update");
  }

  if (!isValidSubject(subject)) {
    redirect("/dashboard/classes?error=invalid_subject");
  }

  const { data, error } = await supabase
    .from("classes")
    .update({ name, subject })
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      redirect("/dashboard/classes?error=duplicate");
    }

    redirect("/dashboard/classes?error=update_failed");
  }

  if (!data) {
    redirect("/dashboard/classes?error=not_found");
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard");
  redirect("/dashboard/classes");
}

export async function deleteClass(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const classId = formData.get("id");
  if (typeof classId !== "string" || !classId) {
    redirect("/dashboard/classes?error=invalid_delete");
  }

  // Penjaga hapus kelas (perintah pemilik, 18 Nov 2026): menghapus
  // kelas menjalankan rantai cascade basis data yang menghapus
  // seluruh siswa kelas itu beserta semua pekerjaan mereka
  // (jawaban latihan, progres Tugas Susulan, hasil game solo,
  // esai). Karena cakupannya sebesar itu, server memeriksa ulang
  // di sini bahwa guru mengetik nama kelas PERSIS seperti nama
  // kelasnya, sama seperti yang diwajibkan modal konfirmasi di
  // halaman. Ketikan yang tidak sama membatalkan penghapusan.
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (classError || !classRow) {
    redirect("/dashboard/classes?error=not_found");
  }

  const confirmName = normalizeName(formData.get("confirm_name"));
  if (confirmName !== classRow.name) {
    redirect("/dashboard/classes?error=name_mismatch");
  }

  const { data, error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId)
    .eq("teacher_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    redirect("/dashboard/classes?error=delete_failed");
  }

  if (!data) {
    redirect("/dashboard/classes?error=not_found");
  }

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard");
  redirect("/dashboard/classes");
}