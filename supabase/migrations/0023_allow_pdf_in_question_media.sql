-- 0023_allow_pdf_in_question_media.sql
-- Tambahkan application/pdf ke allowed_mime_types bucket question-media.
-- Tidak menghapus MIME yang sudah ada (audio/image/video tetap jalan).

update storage.buckets
set allowed_mime_types = array(
  select distinct unnest(
    coalesce(allowed_mime_types, '{}'::text[]) || 'application/pdf'::text
  )
)
where id = 'question-media';