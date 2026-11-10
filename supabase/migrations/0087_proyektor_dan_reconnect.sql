-- ============================================================================
-- 0087_proyektor_dan_reconnect.sql
-- Status: DRAF menunggu persetujuan pemilik per berkas. BELUM diterapkan
-- ke basis data mana pun. Pasangan aplikasi: cabang fix/projector
-- (src/app/join/actions.ts, src/app/api/rooms/session/route.ts,
-- projector-screen.tsx, src/types/database.ts). Terapkan migrasi dan
-- deploy aplikasi dalam jendela yang sama; lihat "Urutan penerapan".
-- Dasar definisi: tangkapan produksi 0094 (diekspor 10 Nov 2026) dan
-- rancangan resmi gelombang2-draf/0085_proyektor_dan_reconnect_DRAF.sql.
--
-- Temuan yang ditutup:
-- 1. W3-K1 / W5-M4: reconnect_room_participant versi produksi (teks di
--    0094:150-216, sama dengan migrasi 0079) menyambungkan ulang
--    peserta room kelas hanya dengan kode room + nama siswa. Siapa pun
--    yang tahu kode room dan nama seorang siswa merebut join_token
--    peserta itu.
-- 2. W3-K2: fungsi yang sama mengembalikan rooms.snapshot UTUH,
--    termasuk correct_option_key dan explanation tiap soal. Snapshot
--    dibangun di src/app/dashboard/games/actions.ts:871-915 dan memang
--    memuat kedua kunci itu (baris 883-884), jadi kunci jawaban room
--    yang sedang berjalan bocor ke pemanggil anon mana pun yang lolos
--    jalur 1.
-- 3. W7-M2 / W5-K1 (lapisan RPC): sync_projector_room_state dapat
--    dipanggil role anon (grant di migrasi 0078:192-193), sehingga
--    state permainan room proyektor mana pun dapat ditimpa pemegang
--    anon key yang tahu kode room. Sisi route sudah digerbangi sesi
--    guru pada gelombang 1 (src/app/api/projector/controller/route.ts,
--    aksi sync_state menolak tanpa getUser); lapisan RPC-nya belum.
-- 4. W5-K2 (lapisan RPC): press_projector_button produksi
--    (0094:15-148) (a) MEMBUAT baris room baru untuk kode room apa pun
--    yang belum ada (room hantu), (b) tidak memeriksa kedaluwarsa
--    baris room, dan (c) tidak mempunyai penjaga fase, sehingga press
--    pada fase lobby berindeks soal 0 tercatat sebagai jawaban.
--    Fallback in-memory store TypeScript sudah mempunyai penjaga fase
--    (src/lib/game-engine/projector-controller-store.ts,
--    applyPressToRoomData); RPC-nya tertinggal.
--
-- Bukti Fase A (pemetaan pemanggil dari kode worktree ini):
-- - reconnect_room_participant dipanggil hanya dari dua tempat,
--   keduanya server-side atas permintaan siswa anon (siswa tidak punya
--   sesi Supabase Auth; sesi siswa adalah sesi kustom): server action
--   joinRoom (src/app/join/actions.ts) dan langkah 4 route sesi
--   (src/app/api/rooms/session/route.ts). Kredensial yang SUDAH
--   dimiliki pemanggil sah hari ini: formulir join mengumpulkan PIN
--   siswa (field "pin" di src/app/join/page.tsx) dan joinRoom sudah
--   meneruskan PIN itu ke join_room, hanya belum ke reconnect;
--   halaman room memegang join_token peserta di sessionStorage dan
--   mengirimnya sebagai parameter token ke route sesi. Gerbang
--   "PIN atau join_token" karena itu tidak menuntut kredensial baru.
-- - sync_projector_room_state dipanggil hanya dari route controller
--   aksi sync_state (src/app/api/projector/controller/route.ts), yang
--   sudah menolak permintaan tanpa sesi guru. Klien store di dalam
--   route itu dibuat dari createClient() yang sama
--   (src/lib/supabase/server.ts: cookie sesi request yang sama),
--   sehingga RPC berjalan sebagai role authenticated dengan JWT guru.
--   Tidak ada pemanggil anon yang sah untuk sync. Tabel
--   projector_room_states tidak mempunyai kolom pemilik, jadi
--   pemeriksaan kepemilikan per room di dalam fungsi tidak mempunyai
--   bahan; gerbang yang benar di lapisan RPC adalah pencabutan grant
--   anon (gerbang peran), sejalan dengan gerbang sesi di route.
-- - press/get/touch dipanggil dari route yang sama atas permintaan
--   stik siswa anon. Di mode hotseat stik TIDAK mempunyai kredensial
--   kuat apa pun selain kode room (tim dipilih bebas di layar stik).
--   Karena itu berkas ini TIDAK mengarang skema token untuk press;
--   permukaannya dipersempit (room harus sudah ada, belum kedaluwarsa,
--   fase question) dan grant anon dipertahankan.
-- - Penskoran layar proyektor hari ini CAMPURAN: listener broadcast
--   Supabase dan BroadcastChannel memanggil handleRecordAnswer
--   langsung dari payload broadcast tak terautentikasi
--   (projector-screen.tsx:681-687 dan 715-720), sedangkan poller GET
--   menskor dari event store hasil RPC press (:832-861). Penutupan
--   sisi layarnya ada di Fase C paket ini (broadcast hanya pemicu
--   poll; skor hanya dari event store).
--
-- Isi berkas:
-- A. reconnect_room_participant ditulis ulang: tanda tangan baru
--    (p_code, p_name, p_pin default null, p_join_token default null),
--    fungsi lama di-drop dulu. Gerbang kepemilikan sesudah peserta
--    ditemukan; snapshot disanitasi di dalam SQL untuk SEMUA cabang
--    yang mengembalikannya (termasuk cabang room ended).
-- B. sync_projector_room_state: revoke execute dari anon; grant
--    authenticated dipertahankan (ditegaskan ulang).
-- C. press_projector_button: badan produksi 0094 dipertahankan persis,
--    ditambah tiga penjaga (room harus ada, belum kedaluwarsa, fase
--    question). Tanda tangan dan bentuk kembalian tidak berubah.
--
-- Yang TIDAK ditutup berkas ini (dinyatakan terbuka):
-- - Impersonasi press hotseat: siapa pun yang mengetahui kode room
--   tetap dapat menekan tombol sebagai tim mana pun, karena mode
--   hotseat memang tidak punya kredensial stik. Yang berubah: press
--   sekarang hanya tercatat pada room yang benar-benar dibuka tuan
--   rumah dan sedang dalam fase soal, dan layar (Fase C) tidak lagi
--   menskor broadcast mentah. Skema kredensial stik adalah keputusan
--   desain terpisah di luar berkas ini.
-- - touch_projector_controller masih dapat membuat room hantu dan
--   get_projector_room_state tetap terbuka untuk anon: keduanya tidak
--   membawa otoritas skor dan berada di luar temuan berkas ini (audit
--   wilayah 5 mencatat room hantu touch sebagai Minor).
-- - Fallback Map in-memory di projector-controller-store menutupi
--   kegagalan RPC dengan console.error. Sesudah pencabutan anon di
--   bagian B, apabila suatu saat sesi guru tidak terbawa ke klien
--   store, sync akan jatuh ke memori per-instance dan tampak berhasil
--   padahal tidak terbagi. Itu perilaku lama store, bukan dibuat
--   berkas ini; verifikasi penerapan wajib memeriksa log server untuk
--   pesan kegagalan RPC sync.
-- - Pembatasan laju percobaan reconnect belum ada: PIN siswa pendek
--   dan dapat ditebak berulang lewat RPC ini. Penutupannya butuh
--   tabel pencatatan percobaan; keputusan desain terpisah, sudah
--   dicatat sebagai pertanyaan terbuka di draf 0085.
--
-- Urutan penerapan (WAJIB berpasangan):
-- Terapkan berkas ini lalu deploy aplikasi cabang fix/projector segera
-- sesudahnya, dalam jendela yang sama.
-- - Bila migrasi jalan TANPA aplikasi baru: pemanggil lama memanggil
--   reconnect dengan 2 argumen; PostgREST menyelesaikan ke tanda
--   tangan baru (dua argumen terakhir ber-default), gerbang gagal
--   (PIN/token null), dan reconnect room kelas berhenti bekerja
--   (gagal tertutup) sampai aplikasi baru ter-deploy. Join baru,
--   get_game_session, dan alur bermain tidak tersentuh.
-- - Bila aplikasi jalan TANPA migrasi: pemanggilan reconnect dengan
--   argumen p_pin/p_join_token ditolak PostgREST (fungsi belum ada)
--   dan reconnect gagal bagi siswa yang membutuhkannya; alur lain
--   tidak tersentuh. Perubahan layar Fase C tetap bekerja karena RPC
--   press versi lama masih menerima press seperti biasa.
-- - Press dan sync tidak berubah tanda tangannya, jadi tidak ada
--   jendela putus untuk keduanya dari sisi pemanggil.
--
-- Verifikasi sesudah penerapan (katalog + probe):
-- 1. pg_proc: reconnect_room_participant hanya punya satu overload
--    (text, text, text, uuid); overload (text, text) sudah tidak ada.
-- 2. Probe reconnect room kelas: tanpa PIN/token -> himpunan kosong;
--    PIN salah -> kosong; PIN benar -> 1 baris dan snapshot hasil
--    tidak memuat correct_option_key/explanation (periksa jsonb);
--    join_token benar -> 1 baris juga.
-- 3. Probe sync sebagai anon lewat PostgREST -> ditolak; sebagai guru
--    login lewat route controller -> state berubah.
-- 4. Probe press: kode room tak dikenal -> STALE_QUESTION dan TIDAK
--    ada baris baru di projector_room_states; room fase lobby ->
--    STALE_QUESTION; room fase question dengan indeks cocok ->
--    success dan event tercatat.
--
-- Rollback: buat ulang reconnect versi 0079 (teks di migrasi 0079:
-- 162-250), grant ulang sync ke anon (teks di migrasi 0078:192-193),
-- dan buat ulang press versi produksi (teks di tangkapan
-- 0094:15-148).
-- ============================================================================

-- ============================================================================
-- A. reconnect_room_participant (W3-K1, W3-K2, W5-M4)
-- ============================================================================

-- Postgres memperlakukan tanda tangan berbeda sebagai overload
-- terpisah: tanpa drop ini, versi 2 argumen yang tidak aman tetap
-- dapat dipanggil berdampingan dengan versi baru.
drop function if exists public.reconnect_room_participant(text, text);

create or replace function public.reconnect_room_participant(
  p_code text,
  p_name text,
  p_pin text default null,
  p_join_token uuid default null
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
  v_pin text := btrim(coalesce(p_pin, ''));
  v_snapshot jsonb;
begin
  select *
  into v_room
  from public.rooms
  where upper(code) = v_code
  limit 1;

  if not found then
    return;
  end if;

  -- Sanitasi snapshot (W3-K2): buang correct_option_key dan
  -- explanation dari objek question tiap entri snapshot->'questions'.
  -- Struktur entri terverifikasi dari pembangun snapshot di
  -- src/app/dashboard/games/actions.ts:871-891: {position,
  -- explanation_timing, question: {..., correct_option_key,
  -- explanation, options, media}}. Kunci lain dipertahankan persis;
  -- entri berbentuk datar (tanpa objek question) dibersihkan juga di
  -- tingkat entrinya untuk berjaga-jaga. Sanitasi dihitung sekali
  -- di sini; hasilnya (v_snapshot) dipakai semua cabang
  -- pengembalian di bawah, termasuk cabang room ended.
...[truncated 10359 chars]
  v_snapshot := v_room.snapshot;

  if v_snapshot is not null
     and jsonb_typeof(v_snapshot -> 'questions') = 'array' then
    select jsonb_set(
             v_snapshot,
             '{questions}',
             coalesce(jsonb_agg(v_entry order by v_ord), '[]'::jsonb)
           )
      into v_snapshot
      from (
        select
          case
            when jsonb_typeof(elem) <> 'object' then elem
            when jsonb_typeof(elem -> 'question') = 'object' then
              (elem - 'correct_option_key' - 'explanation')
              || jsonb_build_object(
                   'question',
                   (elem -> 'question')
                     - 'correct_option_key' - 'explanation'
                 )
            else elem - 'correct_option_key' - 'explanation'
          end as v_entry,
          ord as v_ord
        from jsonb_array_elements(v_snapshot -> 'questions')
          with ordinality as t(elem, ord)
      ) as dibersihkan;
  end if;

  if v_room.state = 'ended' then
    return query
      select v_room.id, v_room.state, null::uuid, null::uuid, null::text,
        v_snapshot,
        v_room.capacity, v_room.started_at, v_room.question_started_at,
        v_room.current_question_index, 0;
    return;
  end if;

  -- Jalur tamu tetap tertutup (0079): room tanpa kelas tidak punya
  -- peserta yang bisa disambungkan ulang.
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

  -- Gerbang kepemilikan (W3-K1, W5-M4): reconnect hanya lolos bila
  -- pemanggil membuktikan kepemilikan sesi peserta, dengan salah
  -- satu dari dua kredensial yang sudah dimiliki pemanggil sah:
  -- join_token peserta itu sendiri (disimpan halaman room di
  -- sessionStorage dan dikirim route sesi sebagai parameter token),
  -- atau PIN siswa yang cocok dengan pin_hash (pola pemeriksaan
  -- join_room di migrasi 0079). Gagal gerbang mengembalikan
  -- himpunan kosong, sama seperti peserta tidak ditemukan, supaya
  -- tidak menjadi oracle pembeda.
  if not (
    (p_join_token is not null and p_join_token = v_participant.join_token)
    or (v_pin <> '' and v_student.pin_hash is not null
        and extensions.crypt(v_pin, v_student.pin_hash)
            = v_student.pin_hash)
  ) then
    return;
  end if;

  return query
  select v_room.id, v_room.state, v_participant.id, v_participant.join_token,
    v_student.name, v_snapshot,
    v_room.capacity, v_room.started_at, v_room.question_started_at,
    v_room.current_question_index,
    (select count(*)::integer from public.submissions s
      where s.room_id = v_room.id and s.room_participant_id = v_participant.id);
  return;
end;
$$;

grant execute on function public.reconnect_room_participant(text, text, text, uuid)
  to anon, authenticated;

-- ============================================================================
-- B. sync_projector_room_state (W7-M2, W5-K1 lapisan RPC)
-- ============================================================================
-- Satu-satunya pemanggil sah adalah route controller aksi sync_state
-- yang sudah digerbangi sesi guru; klien store di dalam route itu
-- membawa sesi yang sama, jadi RPC berjalan sebagai role
-- authenticated. Tidak ada pemanggil anon yang sah: cabut grant
-- anon, tegaskan grant authenticated.

revoke execute on function public.sync_projector_room_state(text, jsonb)
  from anon;

grant execute on function public.sync_projector_room_state(text, jsonb)
  to authenticated;

-- ============================================================================
-- C. press_projector_button (W5-K2 lapisan RPC)
-- ============================================================================
-- Badan fungsi sama persis dengan definisi produksi (tangkapan
-- 0094), ditambah tiga penjaga di awal:
-- 1. Press TIDAK lagi membuat baris room untuk kode yang belum
--    dikenal (produksi membuatnya sebagai room hantu berfase
--    lobby). Room tak dikenal ditolak dengan bentuk kembalian
--    STALE_QUESTION yang sama seperti penolakan produksi lain,
--    tanpa menulis apa pun.
-- 2. Baris room yang expires_at-nya sudah lewat ditolak tanpa
--    memperpanjang masa berlakunya. Mengikuti pola produksi,
--    heartbeat press tetap dicatat ke state; kolom expires_at dan
--    last_seen_at tidak diubah.
-- 3. Penjaga fase: press hanya diterima pada fase 'question'
--    (gameState ->> 'phase'), menyelaraskan RPC dengan penjaga
--    yang sama di fallback in-memory store
--    (applyPressToRoomData di projector-controller-store.ts).
--    Penolakan mengikuti pola penolakan produksi: heartbeat
--    tersimpan dan masa berlaku diperpanjang.
-- Grant anon dipertahankan: stik hotseat tidak mempunyai
-- kredensial kuat selain kode room (lihat kepala berkas).

create or replace function public.press_projector_button(p_room_code text, p_team_id text, p_player_name text, p_option_id text, p_option_key text, p_question_index integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_code text := upper(trim(p_room_code));
  v_key text := upper(trim(coalesce(p_option_key, 'A')));
  v_now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_state jsonb;
  v_expires_at timestamptz;
  v_gs jsonb;
  v_answers jsonb;
  v_room_q integer;
  v_event jsonb;
  v_events jsonb;
begin
  select prs.state, prs.expires_at
  into v_state, v_expires_at
  from public.projector_room_states prs
  where prs.room_code = v_code
  for update;

  -- Penjaga 1: room harus sudah ada (dibuka tuan rumah lewat sync
  -- atau touch). Press tidak membuat baris baru.
  if not found then
    return jsonb_build_object(
      'success', false,
      'error', 'STALE_QUESTION',
      'existingAnswer', null
    );
  end if;

  v_gs := coalesce(v_state -> 'gameState', '{}'::jsonb);
  v_answers := coalesce(v_gs -> 'answeredTeams', '{}'::jsonb);

  -- Heartbeat tim dicatat pada setiap press, termasuk press yang
  -- ditolak (sama seperti produksi).
  v_state := jsonb_set(
    v_state,
    '{heartbeats}',
    coalesce(v_state -> 'heartbeats', '{}'::jsonb)
    || jsonb_build_object(p_team_id, v_now_ms)
  );

  -- Penjaga 2: room yang sudah kedaluwarsa ditolak; expires_at
  -- TIDAK diperpanjang (berbeda dari cabang penolakan di bawah
  -- yang memang memperpanjang room yang masih hidup).
  if v_expires_at <= now() then
    update public.projector_room_states prs
      set state = v_state,
        updated_at = now()
      where prs.room_code = v_code;

    return jsonb_build_object(
      'success', false,
      'error', 'STALE_QUESTION',
      'existingAnswer', null
    );
  end if;

  -- Penjaga 3: jawaban hanya hidup selama fase 'question'.
  if coalesce(v_gs ->> 'phase', '') <> 'question' then
    update public.projector_room_states prs
      set state = v_state,
        last_seen_at = now(),
        expires_at = now() + interval '60 seconds',
        updated_at = now()
      where prs.room_code = v_code;

    return jsonb_build_object(
      'success', false,
      'error', 'STALE_QUESTION',
      'existingAnswer', null
    );
  end if;

  v_room_q := coalesce((v_gs ->> 'currentQuestionIndex')::integer, 0);

  if p_question_index is null or p_question_index <> v_room_q then
    update public.projector_room_states prs
      set state = v_state,
        last_seen_at = now(),
        expires_at = now() + interval '60 seconds',
        updated_at = now()
      where prs.room_code = v_code;

    return jsonb_build_object(
      'success', false,
      'error', 'STALE_QUESTION',
      'existingAnswer', null
    );
  end if;

  if v_answers ? p_team_id then
    update public.projector_room_states prs
      set state = v_state,
        last_seen_at = now(),
        expires_at = now() + interval '60 seconds',
        updated_at = now()
      where prs.room_code = v_code;

    return jsonb_build_object(
      'success', false,
      'error', 'ALREADY_ANSWERED',
      'existingAnswer', v_answers -> p_team_id ->> 'optionKey'
    );
  end if;

  v_answers := v_answers || jsonb_build_object(
    p_team_id,
    jsonb_build_object('optionKey', v_key, 'timestamp', v_now_ms)
  );
  v_gs := jsonb_set(v_gs, '{answeredTeams}', v_answers);
  v_state := jsonb_set(v_state, '{gameState}', v_gs);

  v_event := jsonb_build_object(
    'id', 'evt-' || v_now_ms::text || '-'
      || substr(md5(random()::text || clock_timestamp()::text), 1, 4),
    'roomCode', v_code,
    'teamId', p_team_id,
    'playerName', coalesce(p_player_name, 'Pemain'),
    'optionId', p_option_id,
    'optionKey', v_key,
    'action', 'press',
    'timestamp', v_now_ms
  );

  select coalesce(
    jsonb_agg(e order by (e ->> 'timestamp')::bigint),
    '[]'::jsonb
  )
  into v_events
  from jsonb_array_elements(coalesce(v_state -> 'events', '[]'::jsonb)) as e
  where (e ->> 'timestamp')::bigint > v_now_ms - 60000;

  v_state := jsonb_set(
    v_state,
    '{events}',
    v_events || jsonb_build_array(v_event)
  );

  update public.projector_room_states prs
    set state = v_state,
      last_seen_at = now(),
      expires_at = now() + interval '60 seconds',
      updated_at = now()
    where prs.room_code = v_code;

  return jsonb_build_object(
    'success', true,
    'eventId', v_event ->> 'id',
    'optionKey', v_key,
    'timestamp', v_now_ms,
    'isLocked', true
  );
end;
$function$;

grant execute on function public.press_projector_button(text, text, text, text, text, integer)
  to anon, authenticated;
