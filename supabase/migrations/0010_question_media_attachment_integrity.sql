-- A completed attachment must point to its own canonical object path. This
-- makes the database metadata, Storage RLS path format, and UI upload flow
-- one indivisible contract instead of three independently mutable values.
create or replace function public.assert_question_media_attachment_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.storage_path is not null then
    if new.storage_path <> (new.question_id::text || '/' || new.id::text || '/' || new.expected_filename) then
      raise exception 'media storage path must use <question_id>/<media_id>/<expected_filename>';
    end if;
    if new.original_filename <> new.expected_filename then
      raise exception 'uploaded filename must exactly match expected filename';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_question_media_attachment_path
  before insert or update on public.question_media
  for each row execute function public.assert_question_media_attachment_path();
