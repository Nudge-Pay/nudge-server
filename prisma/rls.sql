-- prisma/rls.sql
-- Optional Row Level Security for Supabase
-- Run manually in Supabase SQL editor AFTER migrations
-- The NestJS server uses the service role key which bypasses RLS entirely
-- These policies apply only to direct Supabase client connections (dashboard, analytics)

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_request_ids ENABLE ROW LEVEL SECURITY;

-- users: read own row
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING ("supabaseUserId" = auth.uid()::text);

-- wallets: read own wallets
CREATE POLICY "wallets_select_own" ON wallets
  FOR SELECT USING (
    "userId" IN (SELECT id FROM users WHERE "supabaseUserId" = auth.uid()::text)
  );

-- payment_requests: read own requests
CREATE POLICY "payment_requests_select_own" ON payment_requests
  FOR SELECT USING (
    "receiverUserId" IN (SELECT id FROM users WHERE "supabaseUserId" = auth.uid()::text)
  );

-- payments: read own payments (sender or receiver)
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (
    "senderUserId" IN (SELECT id FROM users WHERE "supabaseUserId" = auth.uid()::text)
    OR
    "receiverUserId" IN (SELECT id FROM users WHERE "supabaseUserId" = auth.uid()::text)
  );

-- transactions: read own history
CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (
    "userId" IN (SELECT id FROM users WHERE "supabaseUserId" = auth.uid()::text)
  );

-- webauthn_credentials: read own credentials
CREATE POLICY "webauthn_credentials_select_own" ON webauthn_credentials
  FOR SELECT USING (
    "userId" IN (SELECT id FROM users WHERE "supabaseUserId" = auth.uid()::text)
  );

-- webauthn_challenges: no direct client access needed
-- used_request_ids: no direct client access needed