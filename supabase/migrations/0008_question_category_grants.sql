-- Keep question category access explicit: signed-in teachers can manage
-- their own rows through RLS; anonymous clients get no table privileges.
revoke all on table public.question_categories from anon, authenticated;
grant select, insert, update, delete on table public.question_categories to authenticated;
