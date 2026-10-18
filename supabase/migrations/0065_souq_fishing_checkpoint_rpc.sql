-- 0065_souq_fishing_checkpoint_rpc.sql
-- Atomic JSONB merge RPC for Souq & Fishing Game Module checkpointing.
-- Guarantees atomic merge directly in PostgreSQL, eliminating read-modify-write race conditions.

CREATE OR REPLACE FUNCTION souq_fishing_merge_checkpoint(
  p_room_id uuid,
  p_checkpoint jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- size guard juga di DB, defense in depth
  IF octet_length(p_checkpoint::text) > 65536 THEN
    RAISE EXCEPTION 'checkpoint exceeds 64KB';
  END IF;

  UPDATE rooms
  SET snapshot = jsonb_set(
    COALESCE(snapshot, '{}'::jsonb),
    '{souq_fishing,checkpoint_v1}',
    p_checkpoint,
    true
  )
  WHERE id = p_room_id;

  RETURN p_checkpoint;
END;
$$;

REVOKE ALL ON FUNCTION souq_fishing_merge_checkpoint(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION souq_fishing_merge_checkpoint(uuid, jsonb) TO authenticated, service_role, anon;
