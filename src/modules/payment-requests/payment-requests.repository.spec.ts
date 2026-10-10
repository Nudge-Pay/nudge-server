import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentRequestsRepository } from './payment-requests.repository';
import { PrismaService } from '../../database/prisma.service';
import type { CreatePaymentRequestDto } from './dto/create-payment-request.dto';

interface MockTx {
  paymentRequest: {
    create: jest.Mock;
  };
  usedRequestId: {
    create: jest.Mock;
  };
}

interface MockPrismaService {
  usedRequestId: {
    findUnique: jest.Mock;
  };
  paymentRequest: {
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
}

describe('PaymentRequestsRepository', () => {
  let repository: PaymentRequestsRepository;
  let mockPrisma: MockPrismaService;
  let mockTx: MockTx;

  beforeEach(async () => {
    mockTx = {
      paymentRequest: {
        create: jest.fn(),
      },
      usedRequestId: {
        create: jest.fn(),
      },
    };

    mockPrisma = {
      usedRequestId: {
        findUnique: jest.fn(),
      },
      paymentRequest: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: MockTx) => Promise<unknown>) =>
        cb(mockTx),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRequestsRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<PaymentRequestsRepository>(
      PaymentRequestsRepository,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const receiverUserId = 'user-uuid-1';
    const timestampStr = '2026-10-10T12:00:00.000Z';
    const expiresAtStr = '2026-10-10T12:30:00.000Z';

    it('persists payment request and usedRequestId when requestId is present', async () => {
      const dto: CreatePaymentRequestDto = {
        type: 'payment-request',
        version: 1,
        recipient: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        asset: 'USDC',
        amount: '10.00',
        timestamp: timestampStr,
        expiresAt: expiresAtStr,
        requestId: 'req_001',
        memo: 'Invoice 101',
        metadata: { orderId: 'ord_123' },
      };

      mockPrisma.usedRequestId.findUnique.mockResolvedValue(null);
      const fakeCreatedRecord = {
        id: 'pr-uuid-1',
        externalRequestId: 'req_001',
        receiverUserId,
        recipient: dto.recipient,
        asset: dto.asset,
        amount: dto.amount,
        memo: dto.memo,
        payloadTimestamp: new Date(timestampStr),
        expiresAt: new Date(expiresAtStr),
        metadata: dto.metadata,
      };
      mockTx.paymentRequest.create.mockResolvedValue(fakeCreatedRecord);
      mockTx.usedRequestId.create.mockResolvedValue({
        id: 'used-1',
        requestId: 'req_001',
        paymentRequestId: 'pr-uuid-1',
      });

      const result = await repository.create({ dto, receiverUserId });

      expect(mockPrisma.usedRequestId.findUnique).toHaveBeenCalledWith({
        where: { requestId: 'req_001' },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.paymentRequest.create).toHaveBeenCalledWith({
        data: {
          externalRequestId: 'req_001',
          receiverUserId,
          recipient: dto.recipient,
          asset: dto.asset,
          amount: dto.amount,
          memo: 'Invoice 101',
          payloadTimestamp: new Date(timestampStr),
          expiresAt: new Date(expiresAtStr),
          metadata: { orderId: 'ord_123' },
        },
      });
      expect(mockTx.usedRequestId.create).toHaveBeenCalledWith({
        data: {
          requestId: 'req_001',
          paymentRequestId: 'pr-uuid-1',
        },
      });
      expect(result).toBe(fakeCreatedRecord);
    });

    it('creates payment request with null memo and undefined metadata, skipping usedRequestId when requestId is absent', async () => {
      const dto: CreatePaymentRequestDto = {
        type: 'payment-request',
        version: 1,
        recipient: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        asset: 'XLM',
        amount: '50.5',
        timestamp: timestampStr,
        expiresAt: expiresAtStr,
      };

      const fakeCreatedRecord = {
        id: 'pr-uuid-2',
        externalRequestId: null,
        receiverUserId,
        recipient: dto.recipient,
        asset: dto.asset,
        amount: dto.amount,
        memo: null,
        payloadTimestamp: new Date(timestampStr),
        expiresAt: new Date(expiresAtStr),
        metadata: null,
      };
      mockTx.paymentRequest.create.mockResolvedValue(fakeCreatedRecord);

      const result = await repository.create({ dto, receiverUserId });

      expect(mockPrisma.usedRequestId.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.paymentRequest.create).toHaveBeenCalledWith({
        data: {
          externalRequestId: null,
          receiverUserId,
          recipient: dto.recipient,
          asset: dto.asset,
          amount: dto.amount,
          memo: null,
          payloadTimestamp: new Date(timestampStr),
          expiresAt: new Date(expiresAtStr),
          metadata: undefined,
        },
      });
      expect(mockTx.usedRequestId.create).not.toHaveBeenCalled();
      expect(result).toBe(fakeCreatedRecord);
    });

    it('throws ConflictException with PAYMENT_REQUEST_ID_REPLAY before transaction if requestId already used', async () => {
      const dto: CreatePaymentRequestDto = {
        type: 'payment-request',
        version: 1,
        recipient: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        asset: 'USDC',
        amount: '10.00',
        timestamp: timestampStr,
        expiresAt: expiresAtStr,
        requestId: 'already_used_id',
      };

      mockPrisma.usedRequestId.findUnique.mockResolvedValue({
        id: 'used-row-id',
        requestId: 'already_used_id',
        paymentRequestId: 'existing-pr-id',
        createdAt: new Date(),
      });

      await expect(repository.create({ dto, receiverUserId })).rejects.toThrow(
        ConflictException,
      );

      await expect(
        repository.create({ dto, receiverUserId }),
      ).rejects.toMatchObject({
        response: {
          statusCode: 409,
          message: 'Duplicate requestId — payment request already exists.',
          code: 'PAYMENT_REQUEST_ID_REPLAY',
        },
      });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockTx.paymentRequest.create).not.toHaveBeenCalled();
      expect(mockTx.usedRequestId.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the payment request record when found', async () => {
      const fakeRecord = {
        id: 'pr-uuid-123',
        externalRequestId: 'req_001',
        amount: '10',
      };
      mockPrisma.paymentRequest.findUnique.mockResolvedValue(fakeRecord);

      const result = await repository.findById('pr-uuid-123');

      expect(mockPrisma.paymentRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'pr-uuid-123' },
      });
      expect(result).toBe(fakeRecord);
    });

    it('throws NotFoundException with PAYMENT_REQUEST_NOT_FOUND when record is not found', async () => {
      mockPrisma.paymentRequest.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing-uuid')).rejects.toThrow(
        NotFoundException,
      );

      await expect(repository.findById('missing-uuid')).rejects.toMatchObject({
        response: {
          statusCode: 404,
          message: 'Payment request missing-uuid not found.',
          code: 'PAYMENT_REQUEST_NOT_FOUND',
        },
      });
    });
  });
});
