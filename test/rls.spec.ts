import * as fs from 'fs';
import * as path from 'path';

describe('Prisma RLS policies schema compliance', () => {
  const rootDir = path.resolve(__dirname, '..');
  const rlsPath = path.join(rootDir, 'prisma', 'rls.sql');
  const migrationPath = path.join(
    rootDir,
    'prisma',
    'migrations',
    '20260718215932_ding',
    'migration.sql',
  );

  let rlsContent: string;
  let migrationContent: string;

  beforeAll(() => {
    rlsContent = fs.readFileSync(rlsPath, 'utf8');
    migrationContent = fs.readFileSync(migrationPath, 'utf8');
  });

  it('should not contain unquoted snake_case column names in predicates', () => {
    const invalidColumns = [
      'supabase_user_id',
      'receiver_user_id',
      'sender_user_id',
      'user_id',
    ];
    for (const col of invalidColumns) {
      expect(rlsContent).not.toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it('should reference quoted camelCase columns matching migration definitions', () => {
    expect(rlsContent).toContain('"supabaseUserId"');
    expect(rlsContent).toContain('"userId"');
    expect(rlsContent).toContain('"receiverUserId"');
    expect(rlsContent).toContain('"senderUserId"');
  });

  it('every quoted column in rls.sql must exist in migration.sql', () => {
    const quotedCols = rlsContent.match(/"[a-zA-Z0-9_]+"/g) || [];
    const policyNames = new Set([
      '"users_select_own"',
      '"wallets_select_own"',
      '"payment_requests_select_own"',
      '"payments_select_own"',
      '"transactions_select_own"',
      '"webauthn_credentials_select_own"',
    ]);

    for (const quoted of quotedCols) {
      if (policyNames.has(quoted)) continue;
      expect(migrationContent).toContain(quoted);
    }
  });
});
