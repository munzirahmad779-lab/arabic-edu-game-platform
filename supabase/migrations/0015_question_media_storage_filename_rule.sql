create or replace function public.assert_question_media_attachment_path()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  expected_prefix text;
  remainder text;
begin
  if new.storage_path is not null then
    if new.original_filename is null or btrim(new.original_filename) = '' then
      raise exception 'attached media must have an original filename';
    end if;

    expected_prefix :=
      new.question_id::text || '/' || new.id::text || '/';

    if left(new.storage_path, length(expected_prefix)) <> expected_prefix then
      raise exception 'media storage path must use <question_id>/<media_id>/<storage_filename>';
    end if;

    remainder :=
      substring(new.storage_path from length(expected_prefix) + 1);

    if remainder = '' then
      raise exception 'media storage path must contain a storage filename';
    end if;

    if position('/' in remainder) > 0 then
      raise exception 'media storage filename must not contain path separators';
    end if;
  end if;

  return new;
end;
$function$;
