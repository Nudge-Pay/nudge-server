import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { CHALLENGE_TYPE } from '../src/webauthn/webauthn.constants';
import { WebAuthnRepository } from '../src/webauthn/webauthn.repository';

// Run against a disposable, migrated PostgreSQL database, never production:
// TEST_DATABASE_URL=... npx jest --runInBand --testRegex 'webauthn-cleanup.db-spec.ts$'
describe('WebAuthn challenge cleanup (PostgreSQL)', () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error('TEST_DATABASE_URL must name a disposable database');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const repository = new WebAuthnRepository(prisma as PrismaService);
  const userIds: string[] = [];
  let owner: string;
  let other: string;

  beforeEach(async () => {
    for (let i = 0; i < 2; i++) {
      const id = randomUUID();
      await prisma.user.create({
        data: { id, supabaseUserId: randomUUID(), email: `${id}@example.test` },
      });
      userIds.push(id);
    }
    [owner, other] = userIds.slice(-2);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function input(userId: string, paymentId: string | null = 'payment-a') {
    return {
      userId,
      paymentId,
      challenge: randomUUID(),
      type: CHALLENGE_TYPE.AUTHENTICATION,
      expiresAt: new Date(Date.now() + 300_000),
    };
  }

  it('replaces the previous challenge while preserving other users, payments and types', async () => {
    const preserved = await Promise.all([
      repository.createChallenge(input(other)),
      repository.createChallenge(input(owner, 'payment-b')),
      repository.createChallenge({
        ...input(owner, null),
        type: CHALLENGE_TYPE.REGISTRATION,
      }),
    ]);
    const first = await repository.createChallenge(input(owner));
    const second = await repository.createChallenge(input(owner));
    const rows = await prisma.webAuthnChallenge.findMany({
      where: { userId: { in: [owner, other] } },
    });
    expect(rows.map((row) => row.id).sort()).toEqual(
      [...preserved.map((row) => row.id), second.id].sort(),
    );
    expect(rows.some((row) => row.id === first.id)).toBe(false);
  });

  it('removes expired rows during creation and consumption without consuming live rows twice', async () => {
    const stale = await prisma.webAuthnChallenge.create({
      data: { ...input(owner), expiresAt: new Date(0) },
    });
    const live = await repository.createChallenge(input(owner));
    expect(
      await prisma.webAuthnChallenge.findUnique({ where: { id: stale.id } }),
    ).toBeNull();
    const expired = await prisma.webAuthnChallenge.create({
      data: { ...input(owner, 'expired-payment'), expiresAt: new Date(0) },
    });
    await expect(
      repository.consumeLatestValid({
        userId: owner,
        type: CHALLENGE_TYPE.AUTHENTICATION,
        paymentId: 'expired-payment',
      }),
    ).resolves.toBeNull();
    expect(
      await prisma.webAuthnChallenge.findUnique({ where: { id: expired.id } }),
    ).toBeNull();
    const query = {
      userId: owner,
      type: CHALLENGE_TYPE.AUTHENTICATION,
      paymentId: 'payment-a',
    };
    await expect(repository.consumeLatestValid(query)).resolves.toMatchObject({
      id: live.id,
    });
    await expect(repository.consumeLatestValid(query)).resolves.toBeNull();
  });
});
