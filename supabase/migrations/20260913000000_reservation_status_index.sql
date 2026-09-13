-- Reservations are read by status when a build slot opens: everything still
-- "received", oldest first. Small now, and the index is what keeps that true.
-- This is also the first migration to travel the whole way on its own: a
-- pull request applies it to a fresh database in CI, and merging applies it
-- to the live project. If you are reading this in the live schema, the
-- system works.
create index if not exists reservations_status_created_idx
  on public.reservations (status, created_at);
