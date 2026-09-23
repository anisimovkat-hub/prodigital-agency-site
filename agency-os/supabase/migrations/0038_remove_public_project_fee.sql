-- Phase 2: apply only after the application reads/writes project_finances.
-- All non-null fees were copied by 0037, so members can no longer read them
-- through projects or through an arbitrary PostgREST SELECT.
ALTER TABLE public.projects DROP COLUMN IF EXISTS monthly_fee;
