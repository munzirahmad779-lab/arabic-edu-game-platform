-- A Question Bank question always has a topic. The original generic question
-- schema permits category_id = NULL for non-bank questions, so enforce the
-- stricter rule only for rows that belong to a question bank.
create or replace function public.assert_question_bank_category_present()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.question_bank_id is not null and new.category_id is null then
    raise exception 'Question Bank questions must have a category';
  end if;
  return new;
end;
$$;

create trigger trg_question_bank_category_present
  before insert or update of question_bank_id, category_id on public.questions
  for each row execute function public.assert_question_bank_category_present();
