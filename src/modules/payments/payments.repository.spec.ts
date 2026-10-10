import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentsRepository } from './payments.repository';
import { PrismaService } from '../../database/prisma.service';

interface MockPrismaService {
  payment: {
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
}

describe('PaymentsRepository', () => {
  let repository: PaymentsRepository;
  let mockPrisma: MockPrismaService;

  beforeEach(async () => {
    mockPrisma = {
      payment: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<PaymentsRepository>(PaymentsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('returns the payment record when found', async () => {
      const payment = {
        id: 'payment-uuid-1',
        status: PaymentStatus.CREATED,
      };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);

      const result = await repository.findById('payment-uuid-1');

      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-uuid-1' },
      });
      expect(result).toBe(payment);
    });

    it('throws NotFoundException with PAYMENT_NOT_FOUND when payment is not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing-payment-id')).rejects.toThrow(
        NotFoundException,
      );

      await expect(
        repository.findById('missing-payment-id'),
      ).rejects.toMatchObject({
        response: {
          statusCode: 404,
          message: 'Payment missing-payment-id not found.',
          code: 'PAYMENT_NOT_FOUND',
        },
      });
    });
  });

  describe('markAuthorized', () => {
    const paymentId = 'payment-uuid-1';

    it('updates payment status to AUTHORIZED with authorizedAt Date and returns the re-read record when count is 1', async () => {
      const updatedPayment = {
        id: paymentId,
        status: PaymentStatus.AUTHORIZED,
        authorizedAt: new Date(),
      };

      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.payment.findUniqueOrThrow.mockResolvedValue(updatedPayment);

      const result = await repository.markAuthorized(paymentId);

      const calls = mockPrisma.payment.updateMany.mock.calls as unknown as [
        [
          {
            where: { id: string; status: PaymentStatus };
            data: { status: PaymentStatus; authorizedAt: unknown };
          },
        ],
      ];
      expect(calls[0][0].where).toEqual({
        id: paymentId,
        status: PaymentStatus.CREATED,
      });
      expect(calls[0][0].data.status).toBe(PaymentStatus.AUTHORIZED);
      expect(calls[0][0].data.authorizedAt).toBeInstanceOf(Date);

      expect(mockPrisma.payment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: paymentId },
      });
      expect(result).toBe(updatedPayment);
    });

    it('throws ConflictException with PAYMENT_INVALID_STATE when count is 0', async () => {
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.markAuthorized(paymentId)).rejects.toThrow(
        ConflictException,
      );

      await expect(repository.markAuthorized(paymentId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          message: 'Payment is no longer in a CREATED state.',
          code: 'PAYMENT_INVALID_STATE',
        },
      });

      expect(mockPrisma.payment.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('throws ConflictException with PAYMENT_INVALID_STATE when count is greater than 1', async () => {
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 2 });

      await expect(repository.markAuthorized(paymentId)).rejects.toThrow(
        ConflictException,
      );

      await expect(repository.markAuthorized(paymentId)).rejects.toMatchObject({
        response: {
          statusCode: 409,
          message: 'Payment is no longer in a CREATED state.',
          code: 'PAYMENT_INVALID_STATE',
        },
      });

      expect(mockPrisma.payment.findUniqueOrThrow).not.toHaveBeenCalled();
    });
  });
});
