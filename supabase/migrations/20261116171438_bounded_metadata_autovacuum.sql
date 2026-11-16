begin;
set local lock_timeout='2s';
-- Small metadata tables can retain large obsolete TOAST values between updates.
-- Keep cleanup automatic and scoped; no row or backup is deleted by this migration.
alter table public.portal_runtime_state set (autovacuum_vacuum_threshold=10,autovacuum_vacuum_scale_factor=0.05,autovacuum_analyze_threshold=10,autovacuum_analyze_scale_factor=0.05,toast.autovacuum_vacuum_threshold=20,toast.autovacuum_vacuum_scale_factor=0.05);
alter table public.portal_runtime_wire_snapshot set (autovacuum_vacuum_threshold=10,autovacuum_vacuum_scale_factor=0.05,autovacuum_analyze_threshold=10,autovacuum_analyze_scale_factor=0.05,toast.autovacuum_vacuum_threshold=20,toast.autovacuum_vacuum_scale_factor=0.05);
alter table public.portal_runtime_audit_chunks set (autovacuum_vacuum_threshold=10,autovacuum_vacuum_scale_factor=0.05,autovacuum_analyze_threshold=10,autovacuum_analyze_scale_factor=0.05,toast.autovacuum_vacuum_threshold=20,toast.autovacuum_vacuum_scale_factor=0.05);
alter table public.portal_runtime_assets set (autovacuum_vacuum_threshold=10,autovacuum_vacuum_scale_factor=0.05,autovacuum_analyze_threshold=10,autovacuum_analyze_scale_factor=0.05,toast.autovacuum_vacuum_threshold=20,toast.autovacuum_vacuum_scale_factor=0.05);
alter table public.portal_runtime_state_backups set (autovacuum_vacuum_threshold=10,autovacuum_vacuum_scale_factor=0.05,autovacuum_analyze_threshold=10,autovacuum_analyze_scale_factor=0.05,toast.autovacuum_vacuum_threshold=20,toast.autovacuum_vacuum_scale_factor=0.05);
alter table public.portal_audit_events set (autovacuum_vacuum_threshold=10,autovacuum_vacuum_scale_factor=0.05,autovacuum_analyze_threshold=10,autovacuum_analyze_scale_factor=0.05,toast.autovacuum_vacuum_threshold=20,toast.autovacuum_vacuum_scale_factor=0.05);
commit;
