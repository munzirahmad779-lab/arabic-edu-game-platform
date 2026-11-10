-- ============================================================================
-- 0095_perbaiki_grant_sync_proyektor.sql
-- Perbaikan susulan atas 0087 bagian B (diterapkan 10 Nov 2026 tahap 17).
--
-- Masalah: 0087 mencabut execute sync_projector_room_state dari role
-- anon, tetapi verifikasi katalog sesudahnya menunjukkan
-- has_function_privilege('anon', ...) tetap true, dan probe REST nyata
-- membuktikan panggilan anon tetap tereksekusi. Sebabnya: fungsi ini
-- juga memegang grant EXECUTE ke PUBLIC (grant bawaan Postgres untuk
-- fungsi baru yang tidak pernah dicabut migrasi 0078), dan revoke dari
-- anon tidak menyentuh grant PUBLIC.
--
-- Perbaikan: cabut dari PUBLIC, lalu beri grant eksplisit hanya ke
-- authenticated (pemanggil sah: route controller bergerbang sesi guru)
-- dan service_role (jalur server tepercaya).
--
-- Verifikasi sesudah penerapan:
--   select has_function_privilege('anon', p.oid, 'execute'),
--          has_function_privilege('authenticated', p.oid, 'execute'),
--          has_function_privilege('service_role', p.oid, 'execute')
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname = 'sync_projector_room_state';
--   Hasil wajib: false, true, true.
--   Probe REST: POST /rest/v1/rpc/sync_projector_room_state dengan
--   kunci anon wajib ditolak (42501 / 401).
--
-- Rollback: grant execute on function
--   public.sync_projector_room_state(text, jsonb) to public;
-- ============================================================================

revoke execute on function public.sync_projector_room_state(text, jsonb)
  from public;

grant execute on function public.sync_projector_room_state(text, jsonb)
  to authenticated, service_role;
