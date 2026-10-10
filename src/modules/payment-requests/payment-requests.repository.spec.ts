import { PaymentRequestsRepository } from './payment-requests.repository';
import { PrismaService } from '../../database/prisma.service';

describe('PaymentRequestsRepository owner scope', () => {
  const record = { id: 'request-id', receiverUserId: 'internal-owner-id' };
  let findUnique: jest.Mock;
  let repository: PaymentRequestsRepository;

  beforeEach(() => {
    findUnique = jest
      .fn()
      .mockImplementation(
        ({ where }: { where: { id: string; receiverUserId?: string } }) =>
          Promise.resolve(
            where.id === record.id &&
              (where.receiverUserId === undefined ||
                where.receiverUserId === record.receiverUserId)
              ? record
              : null,
          ),
      );
    repository = new PaymentRequestsRepository({
      paymentRequest: { findUnique },
    } as unknown as PrismaService);
  });

  it('returns the record for its internal owner', async () => {
    await expect(
      repository.findById(record.id, record.receiverUserId),
    ).resolves.toEqual(record);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: record.id, receiverUserId: record.receiverUserId },
    });
  });

  it.each([
    ['request-id', 'internal-other-id'],
    ['missing-id', 'internal-owner-id'],
  ])('conceals inaccessible request %s from %s', async (id, receiverUserId) => {
    await expect(repository.findById(id, receiverUserId)).rejects.toMatchObject(
      {
        response: { statusCode: 404, code: 'PAYMENT_REQUEST_NOT_FOUND' },
      },
    );
  });
});
