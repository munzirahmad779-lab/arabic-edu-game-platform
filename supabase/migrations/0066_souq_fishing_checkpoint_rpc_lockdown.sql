-- 0066_souq_fishing_checkpoint_rpc_lockdown.sql
-- CRITICAL: revoke public/anon/authenticated access to checkpoint RPC.
-- ONLY service_role may execute. This prevents client-side anon key
-- from bypassing route handler token validation.

REVOKE ALL ON FUNCTION souq_fishing_merge_checkpoint(uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION souq_fishing_merge_checkpoint(uuid, jsonb) TO service_role;

-- Verify no other roles
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_name = 'souq_fishing_merge_checkpoint'
      AND grantee NOT IN ('service_role', 'postgres', 'supabase_admin')
  LOOP
    RAISE WARNING 'Unexpected grant: % has %', r.grantee, r.privilege_type;
  END LOOP;
END $$;
