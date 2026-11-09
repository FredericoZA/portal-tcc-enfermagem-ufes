begin;
set local lock_timeout = '2s';
set local statement_timeout = '5s';
-- Bound only the backend canonical commit. PostgREST hoists this setting before
-- executing its RPC. Public queries, role defaults and authorization are unchanged.
-- The client still aborts after 20s; this 12s limit avoids repeatedly rolling back
-- a nearly completed canonical transaction at the inherited 8s connection limit.
alter function public.portal_commit_runtime_state(bigint,jsonb) set statement_timeout = '12s';
notify pgrst, 'reload schema';
commit;
