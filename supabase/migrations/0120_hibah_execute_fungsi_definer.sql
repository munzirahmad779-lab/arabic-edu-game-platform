-- ============================================================================
-- 0120_hibah_execute_fungsi_definer.sql
-- Status: DISIAPKAN, BELUM DITERAPKAN. Menunggu pemilik menjalankan berkas
-- ini di Supabase SQL Editor (alur tetap proyek ini).
--
-- Tujuan: menutup sebagian temuan Security Advisor "SECURITY DEFINER
-- function executable by anon/authenticated" (ekspor Advisor 17 Nov
-- 2026: 51 baris anon + 88 baris authenticated, 88 fungsi unik).
-- Audit badan fungsi + pemanggilan aplikasi (grep src) membagi temuan
-- menjadi tiga kelompok; hanya dua kelompok yang diubah berkas ini:
--
-- Kelompok A (8 fungsi): fungsi pemicu murni. Kelimanya assert_*
-- dipasang sebagai fungsi trigger (0001:458-478, 0004:142-152,
-- 0005:132, 0006:142, 0010:25), handle_new_user trigger auth.users
-- (0001:108), prevent_teacher_role_escalation trigger profiles
-- (0001:90), prevent_teacher_email_change trigger profiles
-- (0081:165). Pemicu berjalan tanpa memeriksa hibah EXECUTE peran
-- pemanggil, dan tidak ada pemanggilan rpc ke fungsi ini dari
-- aplikasi, jadi hibah ke public/anon/authenticated dicabut penuh.
--
-- Kelompok B (3 fungsi): RPC khusus guru yang ikut terbuka untuk
-- anon. Ketiganya berpenjaga auth.uid() + pemeriksaan kepemilikan
-- kelas di badan fungsi (0118 untuk teacher_catchup_overview, 0113
-- untuk teacher_daily_report, 0116 untuk
-- teacher_student_game_results) dan hanya dipanggil halaman dasbor
-- guru yang sudah masuk. Hibah dicabut dari public dan anon,
-- ditegaskan tetap ada untuk authenticated.
--
-- Kelompok diterima (tidak diubah, alasan lengkap di laporan agen):
-- fungsi siswa bergerbang token sesi (student_* +
-- verify_student_session), fungsi asesmen bergerbang attempt_token
-- (assessment_*), fungsi ruang permainan bergerbang join_token dan
-- kode ruang + PIN (join_room, submit_game_answer, get_game_session,
-- get_join_session, get_room_leaderboard_student,
-- heartbeat_room_participant, reconnect_room_participant,
-- student_get_my_room_answers, fungsi proyektor), RPC guru/admin
-- berpenjaga auth.uid()/is_super_admin yang memang dipanggil sesudah
-- masuk, fungsi pembantu policy (is_super_admin,
-- can_manage_class_material_storage), dan konten publik baca-saja
-- (get_active_audio_settings, get_active_audio_tracks).
-- Dua fungsi pada daftar Advisor tidak ada di repo dan tidak diubah:
-- public.rls_auto_enable (fungsi platform Supabase) dan
-- public.can_manage_question_media_storage (hanya produksi; diduga
-- pembantu policy storage, mencabutnya tanpa melihat policy produksi
-- berisiko memutus akses media soal).
-- ============================================================================

-- Kelompok A: fungsi pemicu murni
revoke execute on function public.assert_project_relationship_integrity() from public, anon, authenticated;
revoke execute on function public.assert_question_bank_relationship_integrity() from public, anon, authenticated;
revoke execute on function public.assert_question_bank_share_integrity() from public, anon, authenticated;
revoke execute on function public.assert_question_media_attachment_path() from public, anon, authenticated;
revoke execute on function public.assert_question_media_relationship_integrity() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.prevent_teacher_email_change() from public, anon, authenticated;
revoke execute on function public.prevent_teacher_role_escalation() from public, anon, authenticated;

-- Kelompok B: RPC guru yang terbuka untuk anon
revoke execute on function public.teacher_catchup_overview(uuid) from public, anon;
grant execute on function public.teacher_catchup_overview(uuid) to authenticated;
revoke execute on function public.teacher_daily_report(date) from public, anon;
grant execute on function public.teacher_daily_report(date) to authenticated;
revoke execute on function public.teacher_student_game_results(uuid) from public, anon;
grant execute on function public.teacher_student_game_results(uuid) to authenticated;
