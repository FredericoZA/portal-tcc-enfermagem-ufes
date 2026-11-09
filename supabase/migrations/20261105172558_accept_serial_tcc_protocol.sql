alter table public.portal_processes
  drop constraint portal_processes_code_check,
  add constraint portal_processes_code_check
    check (
      code ~ '^[A-Z0-9][A-Z0-9._/-]{2,79}$'
      or code ~ '^[A-Z0-9_-]{1,16} - [0-9]{5}$'
    );
