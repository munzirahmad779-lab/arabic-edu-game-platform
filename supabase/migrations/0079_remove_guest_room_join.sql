-- ============================================================================
-- Migration 0079: Hapus semua jalur tamu untuk siswa masuk room
-- (perintah user 5 Nov 2026, sesudah audit live room V3LBEV)
--
-- Keadaan sebelumnya (0068 + 0073):
-- - Room kelas (class_id terisi) sudah mewajibkan nama + PIN siswa terdaftar.
-- - Room ad-hoc (class_id NULL, dibuat dari permainan yang tidak terikat
--   kelas) masih menerima gabung TAMU: siapa pun yang tahu kode room bisa
--   masuk hanya dengan nama bebas, tanpa PIN dan tanpa kecocokan roster.
--   reconnect_room_participant bahkan MEMBUAT peserta tamu baru bila nama
--   belum terdaftar. Inilah jalur tamu yang tersisa di produksi, sementara
--   halaman /join masih memberi label "opsional untuk tamu" pada kolom PIN.
--
-- Sesudah migrasi ini:
-- - join_room menolak room tanpa kelas dengan pengecualian CLASS_REQUIRED
--   (dipetakan UI /join menjadi pesan yang jelas). Setiap peserta room wajib
--   siswa terdaftar di kelas pemilik room dengan PIN valid.
-- - reconnect_room_participant tidak lagi mencari atau membuat peserta tamu;
--   untuk room tanpa kelas ia mengembalikan himpunan kosong.
-- - Isi fungsi join_room identik 0073 (termasuk kualifikasi
--   extensions.crypt) selain penghapusan cabang tamu tersebut.
-- ============================================================================

-- ------------------------------------------------------------
-- 1. join_room (basis 0073, cabang tamu dihapus)
-- ------------------------------------------------------------
create or replace function public.join_room(
  p_code text,
  p_name text,
  p_pin text default null
)
returns table (
  room_id uuid,
  room_code text,
  game_name text,
  class_id uuid,
  participant_id uuid,
  participant_name text,
  join_token uuid,
  participant_count integer,
  capacity integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_student public.students%rowtype;
  v_participant public.room_participants%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_pin text := btrim(coalesce(p_pin, ''));
  v_count integer;
begin
  if v_code = '' or char_length(v_code) <> 6 then
    raise exception 'INVALID_ROOM_CODE';
  end if;

  if v_name = '' or char_length(v_name) > 100 then
    raise exception 'INVALID_NAME';
  end if;

  select *
  into v_room
  from public.rooms
  where upper(code) = v_code
  limit 1
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  if v_room.state not in ('waiting', 'running') then
    raise exception 'ROOM_NOT_OPEN';
  end if;

  -- Jalur tamu ditutup (0079): room tanpa kelas tidak bisa dimasuki siswa.
  -- Dulu cabang ini menerima gabung nama bebas tanpa PIN untuk room ad-hoc.
  if v_room.class_id is null then
    raise exception 'CLASS_REQUIRED';
  end if;

  -- Room kelas: nama + PIN siswa terdaftar wajib.
  if v_pin = '' then
    raise exception 'PIN_REQUIRED';
  end if;

  select s.*
  into v_student
  from public.students s
  where s.class_id = v_room.class_id
    and lower(btrim(s.name)) = lower(v_name)
  limit 1;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if extensions.crypt(v_pin, v_student.pin_hash) <> v_student.pin_hash then
    raise exception 'INVALID_PIN';
  end if;

  select rp.*
  into v_participant
  from public.room_participants rp
  where rp.room_id = v_room.id
    and rp.student_id = v_student.id
  limit 1;

  if not found then
    select count(*)::integer
    into v_count
    from public.room_participants rp
    where rp.room_id = v_room.id;

    if v_count >= v_room.capacity then
      raise exception 'ROOM_FULL';
    end if;

    insert into public.room_participants (
      room_id,
      student_id,
      connection_state,
      join_token
    )
    values (
      v_room.id,
      v_student.id,
      'connected',
      gen_random_uuid()
    )
    returning * into v_participant;
  end if;

  select count(*)::integer
  into v_count
  from public.room_participants rp
  where rp.room_id = v_room.id;

  return query
  select
    v_room.id,
    v_room.code,
    coalesce(v_room.snapshot->'game'->>'name', 'لعبة'),
    v_room.class_id,
    v_participant.id,
    v_student.name,
    v_participant.join_token,
    v_count,
    v_room.capacity;
end;
$$;

revoke all on function public.join_room(text, text, text) from public, anon;
grant execute on function public.join_room(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. reconnect_room_participant (basis 0068, cabang tamu dihapus)
-- ------------------------------------------------------------
create or replace function public.reconnect_room_participant(
  p_code text,
  p_name text
)
returns table (
  room_id uuid,
  room_state text,
  participant_id uuid,
  join_token uuid,
  participant_name text,
  snapshot jsonb,
  capacity integer,
  started_at timestamptz,
  question_started_at timestamptz,
  current_question_index integer,
  question_index integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_student public.students%rowtype;
  v_participant public.room_participants%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  select *
  into v_room
  from public.rooms
  where upper(code) = v_code
  limit 1;

  if not found then
    return;
  end if;

  if v_room.state = 'ended' then
    return query
    select v_room.id, v_room.state, null::uuid, null::uuid, null::text, v_room.snapshot,
           v_room.capacity, v_room.started_at, v_room.question_started_at,
           v_room.current_question_index, 0;
    return;
  end if;

  -- Jalur tamu ditutup (0079): room tanpa kelas tidak punya peserta yang
  -- bisa disambungkan ulang. Versi 0068 di sini mencari peserta tamu
  -- menurut nama dan MEMBUAT peserta tamu baru bila belum ada.
  if v_room.class_id is null then
    return;
  end if;

  select s.*
  into v_student
  from public.students s
  where s.class_id = v_room.class_id
    and lower(btrim(s.name)) = lower(v_name)
  limit 1;

  if not found then
    return;
  end if;

  select rp.*
  into v_participant
  from public.room_participants rp
  where rp.room_id = v_room.id
    and rp.student_id = v_student.id
  limit 1;

  if not found then
    return;
  end if;

  return query
  select v_room.id, v_room.state, v_participant.id, v_participant.join_token,
         v_student.name, v_room.snapshot,
         v_room.capacity, v_room.started_at, v_room.question_started_at,
         v_room.current_question_index,
         (select count(*)::integer from public.submissions s
           where s.room_id = v_room.id and s.room_participant_id = v_participant.id);
  return;
end;
$$;

revoke all on function public.reconnect_room_participant(text, text) from public;
grant execute on function public.reconnect_room_participant(text, text) to anon, authenticated;

-- Reload schema cache in PostgREST
notify pgrst, 'reload schema';
