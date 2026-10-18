# Security Audit — Checkpoint API

## Finding #1: GRANT EXECUTE TO anon (CRITICAL, RESOLVED in 0066)
- Severity: Critical
- Vector: anon key shipped in client bundle allows direct RPC call
- Fix: REVOKE anon, authenticated. GRANT only service_role.
- Verification: migration 0066 + manual SQL check

## Finding #2: session.id !== token backdoor (MAJOR, RESOLVED)
- Severity: High
- Vector: session UUID (visible in URLs/logs) accepted as token
- Fix: removed fallback; only join_token valid
- Verification: test case 11

## Finding #3: Token validation via join_token (ACCEPTED)
- Severity: Info
- Decision: room_participants.join_token is the canonical auth for checkpoint
- Rationale: projector does not need separate auth if using service_role route
