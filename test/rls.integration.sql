-- Run with psql -v ON_ERROR_STOP=1 -f test/rls.integration.sql against a
-- disposable database after prisma migrate deploy. Everything rolls back.
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
\ir ../prisma/rls.sql

CREATE ROLE rls_test_client NOLOGIN;
GRANT USAGE ON SCHEMA public, auth TO rls_test_client;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rls_test_client;

INSERT INTO users (id, "supabaseUserId", email, "updatedAt") VALUES
  ('rls-owner', '00000000-0000-4000-8000-000000000001', 'owner@example.test', now()),
  ('rls-other', '00000000-0000-4000-8000-000000000002', 'other@example.test', now());
INSERT INTO wallets (id, "userId", "stellarPublicKey", network) VALUES
  ('rls-owner-wallet', 'rls-owner', 'owner-key', 'TESTNET'),
  ('rls-other-wallet', 'rls-other', 'other-key', 'TESTNET');

SET LOCAL ROLE rls_test_client;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
DO $$ BEGIN
  IF (SELECT count(*) FROM users) <> 1 OR
     (SELECT id FROM users LIMIT 1) <> 'rls-owner' THEN
    RAISE EXCEPTION 'users policy did not isolate the authenticated user';
  END IF;
  IF (SELECT count(*) FROM wallets) <> 1 OR
     (SELECT id FROM wallets LIMIT 1) <> 'rls-owner-wallet' THEN
    RAISE EXCEPTION 'wallets policy did not isolate the authenticated user';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM wallets) THEN
    RAISE EXCEPTION 'anonymous connection can read private rows';
  END IF;
END $$;
ROLLBACK;
