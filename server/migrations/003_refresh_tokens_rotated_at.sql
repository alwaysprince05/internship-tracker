-- A rotated token is kept (marked, not deleted) so that a second request with
-- it can be told apart: a parallel request right after rotation, or reuse of a
-- stolen token later on.
ALTER TABLE refresh_tokens ADD COLUMN rotated_at TIMESTAMPTZ;
