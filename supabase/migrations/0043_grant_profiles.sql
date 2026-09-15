-- 0043_grant_profiles.sql
-- Tabel profiles kehilangan grant standar untuk role authenticated.
-- Beri izin SELECT + UPDATE + INSERT.

grant select, insert, update
  on public.profiles
  to authenticated;

grant select
  on public.profiles
  to anon;