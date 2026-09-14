-- 0024_delete_question_bank.sql
-- RPC untuk hapus bank soal + semua soal di dalamnya (question_options,
-- question_media, game_questions terkait) dengan urutan yang aman.

create or replace function public.delete_question_bank(p_bank_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_teacher_id uuid;
begin
  select teacher_id into v_teacher_id
  from public.question_banks
  where id = p_bank_id;

  if v_teacher_id is null then
    raise exception 'bank_not_found';
  end if;

  if v_teacher_id <> auth.uid() then
    raise exception 'forbidden';
  end if;

  -- 1. Hapus submissions (jawaban siswa) untuk soal di bank ini
  delete from public.submissions
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 2. Hapus game_questions (relasi game ke soal)
  delete from public.game_questions
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 3. Hapus question_media
  delete from public.question_media
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 4. Hapus question_options
  delete from public.question_options
  where question_id in (
    select id from public.questions where question_bank_id = p_bank_id
  );

  -- 5. Hapus questions
  delete from public.questions where question_bank_id = p_bank_id;

  -- 6. Hapus bank
  delete from public.question_banks where id = p_bank_id;
end;
$$;

revoke all on function public.delete_question_bank(uuid) from public;
grant execute on function public.delete_question_bank(uuid) to authenticated;