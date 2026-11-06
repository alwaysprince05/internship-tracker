-- Expired tokens are deleted per user on login, so look them up by user_id.
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens(user_id);
