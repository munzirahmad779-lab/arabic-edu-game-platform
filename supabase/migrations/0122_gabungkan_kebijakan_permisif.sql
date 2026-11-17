-- ============================================================================
-- 0122_gabungkan_kebijakan_permisif.sql
-- Status: DISIAPKAN, BELUM DITERAPKAN. Menunggu pemilik menjalankan berkas
-- ini di Supabase SQL Editor (alur tetap proyek ini). Jalankan SESUDAH
-- 0121.
--
-- Tujuan: menutup 4 dari 5 temuan Performance Advisor "Multiple
-- Permissive Policies" (ekspor Advisor 17 Nov 2026). Pada tiap tabel
-- di bawah, beberapa policy permisif untuk peran dan aksi yang sama
-- (SELECT oleh authenticated) digabung menjadi satu policy yang
-- ekspresinya adalah OR dari ekspresi asal. Kebijakan permisif memang
-- digabungkan PostgreSQL dengan OR, jadi makna akses tidak berubah;
-- policy lama dihapus dan diganti satu policy gabungan. Ekspresi
-- anggota sekaligus ditulis dalam bentuk terbungkus (select ...) agar
-- konsisten dengan perbaikan initplan 0121 (khususnya
-- questions_select_own yang juga anggota daftar initplan).
--
-- Kombinasi kelima pada daftar Advisor, room_participants
-- (room_participants_select_via_owned_room +
-- room_participants_teacher_select), TIDAK digabung di sini:
-- policy room_participants_teacher_select ada di produksi tetapi
-- definisinya tidak ada di migrasi repo, jadi ekspresi gabungannya
-- tidak bisa dibentuk tanpa menebak. Ambil ekspresinya dari
-- pg_policies lebih dulu (kueri contoh ada di akhir 0121).
-- ============================================================================

-- question_bank_shares: gabung 2 policy menjadi question_bank_shares_select_own_or_shared
drop policy if exists question_bank_shares_owner_select on public.question_bank_shares;
drop policy if exists question_bank_shares_recipient_select on public.question_bank_shares;
create policy question_bank_shares_select_own_or_shared on public.question_bank_shares
  for select
  to authenticated
  using ((owner_id = (select auth.uid())) or (shared_with_user_id = (select auth.uid()) and status = 'active'));

-- question_banks: gabung 2 policy menjadi question_banks_select_own_or_shared
drop policy if exists question_banks_select_own on public.question_banks;
drop policy if exists question_banks_select_shared on public.question_banks;
create policy question_banks_select_own_or_shared on public.question_banks
  for select
  to authenticated
  using ((teacher_id = (select auth.uid())) or (exists ( select 1 from public.question_bank_shares qbs where qbs.question_bank_id = question_banks.id and qbs.shared_with_user_id = (select auth.uid()) and qbs.status = 'active' )));

-- question_options: gabung 2 policy menjadi question_options_select_own_or_shared_bank
drop policy if exists question_options_select_own_bank on public.question_options;
drop policy if exists question_options_select_shared_bank on public.question_options;
create policy question_options_select_own_or_shared_bank on public.question_options
  for select
  to authenticated
  using ((exists ( select 1 from public.questions q join public.question_banks qb on qb.id = q.question_bank_id where q.id = question_options.question_id and qb.teacher_id = (select auth.uid()) )) or (exists ( select 1 from public.questions q join public.question_bank_shares qbs on qbs.question_bank_id = q.question_bank_id where q.id = question_options.question_id and qbs.shared_with_user_id = (select auth.uid()) and qbs.status = 'active' )));

-- questions: gabung 3 policy menjadi questions_select_own_or_shared_bank
drop policy if exists questions_select_own on public.questions;
drop policy if exists questions_select_own_bank on public.questions;
drop policy if exists questions_select_shared_bank on public.questions;
create policy questions_select_own_or_shared_bank on public.questions
  for select
  to authenticated
  using ((teacher_id = (select auth.uid())) or (exists ( select 1 from public.question_banks qb where qb.id = questions.question_bank_id and qb.teacher_id = (select auth.uid()) )) or (exists ( select 1 from public.question_bank_shares qbs where qbs.question_bank_id = questions.question_bank_id and qbs.shared_with_user_id = (select auth.uid()) and qbs.status = 'active' )));
