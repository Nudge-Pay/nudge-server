import { CHALLENGE_TYPE } from './webauthn.constants';
import { WebAuthnRepository } from './webauthn.repository';

describe('WebAuthnRepository', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createChallenge', () => {
    it('cleans up existing and expired challenges in the same transaction before inserting the new one', async () => {
      const now = new Date('2026-10-06T12:00:00.000Z');
      const expiresAt = new Date('2026-10-06T12:05:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      const createdRecord = {
        id: 'new-ch-id',
        userId: 'user-1',
        challenge: 'new-challenge-string',
        type: CHALLENGE_TYPE.REGISTRATION,
        paymentId: null,
        expiresAt,
        createdAt: now,
      };

      const transaction = {
        webAuthnChallenge: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn().mockResolvedValue(createdRecord),
        },
      };

      const prisma = {
        $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
        ),
      };

      const repository = new WebAuthnRepository(prisma as never);

      const result = await repository.createChallenge({
        userId: 'user-1',
        challenge: 'new-challenge-string',
        type: CHALLENGE_TYPE.REGISTRATION,
        expiresAt,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(transaction.webAuthnChallenge.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              userId: 'user-1',
              type: CHALLENGE_TYPE.REGISTRATION,
              paymentId: null,
            },
            {
              expiresAt: { lte: now },
            },
          ],
        },
      });
      expect(transaction.webAuthnChallenge.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          challenge: 'new-challenge-string',
          type: CHALLENGE_TYPE.REGISTRATION,
          paymentId: null,
          expiresAt,
        },
      });
      expect(result).toEqual(createdRecord);
    });

    it('requesting options twice deletes prior challenge and leaves only newest', async () => {
      const now = new Date('2026-10-06T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      const firstRecord = {
        id: 'ch-1',
        userId: 'user-1',
        challenge: 'first-challenge',
        type: CHALLENGE_TYPE.AUTHENTICATION,
        paymentId: 'pay-1',
        expiresAt: new Date(now.getTime() + 300000),
      };

      const secondRecord = {
        id: 'ch-2',
        userId: 'user-1',
        challenge: 'second-challenge',
        type: CHALLENGE_TYPE.AUTHENTICATION,
        paymentId: 'pay-1',
        expiresAt: new Date(now.getTime() + 300000),
      };

      const transaction = {
        webAuthnChallenge: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest
            .fn()
            .mockResolvedValueOnce(firstRecord)
            .mockResolvedValueOnce(secondRecord),
        },
      };

      const prisma = {
        $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
        ),
      };

      const repository = new WebAuthnRepository(prisma as never);

      const res1 = await repository.createChallenge({
        userId: 'user-1',
        challenge: 'first-challenge',
        type: CHALLENGE_TYPE.AUTHENTICATION,
        paymentId: 'pay-1',
        expiresAt: firstRecord.expiresAt,
      });

      const res2 = await repository.createChallenge({
        userId: 'user-1',
        challenge: 'second-challenge',
        type: CHALLENGE_TYPE.AUTHENTICATION,
        paymentId: 'pay-1',
        expiresAt: secondRecord.expiresAt,
      });

      expect(res1).toEqual(firstRecord);
      expect(res2).toEqual(secondRecord);
      expect(transaction.webAuthnChallenge.deleteMany).toHaveBeenCalledTimes(2);
      expect(transaction.webAuthnChallenge.deleteMany).toHaveBeenLastCalledWith(
        {
          where: {
            OR: [
              {
                userId: 'user-1',
                type: CHALLENGE_TYPE.AUTHENTICATION,
                paymentId: 'pay-1',
              },
              {
                expiresAt: { lte: now },
              },
            ],
          },
        },
      );
    });
  });

  describe('consumeLatestValid', () => {
    it('sweeps expired challenges and does not consume a stale challenge', async () => {
      const now = new Date('2026-10-06T12:00:00.000Z');
      const expiredChallenge = {
        id: 'expired-challenge',
        userId: 'user-1',
        challenge: 'stale',
        type: CHALLENGE_TYPE.REGISTRATION,
        paymentId: null,
        expiresAt: new Date(now.getTime() - 1),
      };
      jest.useFakeTimers().setSystemTime(now);

      const transaction = {
        webAuthnChallenge: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn(
            ({ where }: { where: { expiresAt?: { gt?: Date } } }) => {
              const cutoff = where.expiresAt?.gt;
              return cutoff && expiredChallenge.expiresAt > cutoff
                ? expiredChallenge
                : null;
            },
          ),
          delete: jest.fn(),
        },
      };
      const prisma = {
        $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
        ),
      };
      const repository = new WebAuthnRepository(prisma as never);

      await expect(
        repository.consumeLatestValid({
          userId: 'user-1',
          type: CHALLENGE_TYPE.REGISTRATION,
        }),
      ).resolves.toBeNull();

      expect(transaction.webAuthnChallenge.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lte: now },
        },
      });
      expect(transaction.webAuthnChallenge.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: CHALLENGE_TYPE.REGISTRATION,
          paymentId: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(transaction.webAuthnChallenge.delete).not.toHaveBeenCalled();
    });

    it('consumes and deletes a valid challenge in the transaction', async () => {
      const now = new Date('2026-10-06T12:00:00.000Z');
      const validChallenge = {
        id: 'valid-challenge',
        userId: 'user-1',
        challenge: 'fresh',
        type: CHALLENGE_TYPE.REGISTRATION,
        paymentId: null,
        expiresAt: new Date(now.getTime() + 60000),
      };
      jest.useFakeTimers().setSystemTime(now);

      const transaction = {
        webAuthnChallenge: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn().mockResolvedValue(validChallenge),
          delete: jest.fn().mockResolvedValue(validChallenge),
        },
      };
      const prisma = {
        $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
        ),
      };
      const repository = new WebAuthnRepository(prisma as never);

      const result = await repository.consumeLatestValid({
        userId: 'user-1',
        type: CHALLENGE_TYPE.REGISTRATION,
      });

      expect(result).toEqual(validChallenge);
      expect(transaction.webAuthnChallenge.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lte: now },
        },
      });
      expect(transaction.webAuthnChallenge.delete).toHaveBeenCalledWith({
        where: { id: 'valid-challenge' },
      });
    });
  });
});
