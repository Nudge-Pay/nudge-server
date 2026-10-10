import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { ChallengeType } from './webauthn.constants';

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface CreateChallengeInput {
  userId: string;
  challenge: string;
  type: ChallengeType;
  paymentId?: string | null;
  expiresAt: Date;
}

export interface ConsumeChallengeQuery {
  userId: string;
  type: ChallengeType;
  paymentId?: string | null;
}

export interface CreateCredentialInput {
  userId: string;
  credentialId: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: bigint;
  deviceName?: string | null;
}

@Injectable()
export class WebAuthnRepository {
  constructor(private readonly prisma: PrismaService) {}

  createChallenge(input: CreateChallengeInput) {
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const now = new Date();
      await tx.webAuthnChallenge.deleteMany({
        where: {
          OR: [
            {
              userId: input.userId,
              type: input.type,
              paymentId: input.paymentId ?? null,
            },
            {
              expiresAt: { lte: now },
            },
          ],
        },
      });

      return tx.webAuthnChallenge.create({
        data: {
          userId: input.userId,
          challenge: input.challenge,
          type: input.type,
          paymentId: input.paymentId ?? null,
          expiresAt: input.expiresAt,
        },
      });
    });
  }

  async consumeLatestValid(query: ConsumeChallengeQuery) {
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const now = new Date();
      await tx.webAuthnChallenge.deleteMany({
        where: {
          expiresAt: { lte: now },
        },
      });

      const candidate = await tx.webAuthnChallenge.findFirst({
        where: {
          userId: query.userId,
          type: query.type,
          paymentId: query.paymentId ?? null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!candidate) {
        return null;
      }

      await tx.webAuthnChallenge.delete({ where: { id: candidate.id } });
      return candidate;
    });
  }

  createCredential(input: CreateCredentialInput) {
    return this.prisma.webAuthnCredential.create({
      data: {
        userId: input.userId,
        credentialId: input.credentialId,
        publicKey: input.publicKey,
        counter: input.counter,
        deviceName: input.deviceName ?? null,
      },
    });
  }

  listByUser(userId: string) {
    return this.prisma.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  countByUser(userId: string) {
    return this.prisma.webAuthnCredential.count({ where: { userId } });
  }

  findByCredentialId(credentialId: string) {
    return this.prisma.webAuthnCredential.findUnique({
      where: { credentialId },
    });
  }

  /** Scoped lookup by internal `id` (not `credentialId`) for device management. */
  findByIdForUser(id: string, userId: string) {
    return this.prisma.webAuthnCredential.findFirst({
      where: { id, userId },
    });
  }

  updateCounter(credentialId: string, counter: bigint, lastUsedAt: Date) {
    return this.prisma.webAuthnCredential.update({
      where: { credentialId },
      data: { counter, lastUsedAt },
    });
  }

  deleteById(id: string) {
    return this.prisma.webAuthnCredential.delete({ where: { id } });
  }

  findPaymentById(id: string) {
    return this.prisma.payment.findUnique({ where: { id } });
  }
}
