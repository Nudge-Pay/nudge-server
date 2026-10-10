import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  PaymentRequestV1,
  PaymentRequestValidationError,
  validatePaymentRequestV1,
} from '../../contracts/payment-request.v1';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { PaymentRequestResponseDto } from './dto/payment-request-response.dto';
import { PaymentRequestsRepository } from './payment-requests.repository';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

type PrismaPaymentRequest = Awaited<
  ReturnType<PaymentRequestsRepository['findById']>
>;

export interface PaymentRequestValidationResponse {
  valid: boolean;
  normalized?: PaymentRequestV1;
  errors: PaymentRequestValidationError[];
}

function toResponseDto(pr: PrismaPaymentRequest): PaymentRequestResponseDto {
  return {
    id: pr.id,
    status: pr.status,
    externalRequestId: pr.externalRequestId,
    recipient: pr.recipient,
    asset: pr.asset,
    amount: pr.amount.toString(),
    expiresAt: pr.expiresAt.toISOString(),
    createdAt: pr.createdAt.toISOString(),
    memo: pr.memo ?? null,
    metadata: (pr.metadata as Record<string, unknown> | null) ?? null,
  };
}

@Injectable()
export class PaymentRequestsService {
  constructor(
    private readonly repo: PaymentRequestsRepository,
    private readonly usersService: UsersService,
  ) {}

  /** SRV-036/037: Stateless validation — no DB touch. */
  validate(payload: unknown): PaymentRequestValidationResponse {
    const result = validatePaymentRequestV1(payload, new Date());

    if (result.valid) {
      return { valid: true, normalized: result.value, errors: [] };
    }

    return { valid: false, errors: result.errors };
  }

  /**
   * SRV-038/039: Persist a receiver payment request.
   * Validates the v1 contract first, then delegates to the repo which
   * atomically guards the requestId anti-replay via UsedRequestId.
   */
  async create(
    dto: CreatePaymentRequestDto,
    user: AuthenticatedUser,
  ): Promise<PaymentRequestResponseDto> {
    const rawPayload: Record<string, unknown> = {
      type: dto.type,
      version: dto.version,
      recipient: dto.recipient,
      asset: dto.asset,
      amount: dto.amount,
      timestamp: dto.timestamp,
      expiresAt: dto.expiresAt,
    };
    if (dto.memo !== undefined) rawPayload.memo = dto.memo;
    if (dto.requestId !== undefined) rawPayload.requestId = dto.requestId;
    if (dto.metadata !== undefined) rawPayload.metadata = dto.metadata;

    const validation = validatePaymentRequestV1(rawPayload, new Date());

    if (!validation.valid) {
      const messages = validation.errors
        .map((e) => `${e.field ?? 'payload'}: ${e.message}`)
        .join('; ');
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: messages,
        code: validation.errors[0]?.code,
        errors: validation.errors,
      });
    }

    const receiver = await this.usersService.getUserBySupabaseId(
      user.supabaseUserId,
    );
    if (!receiver) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    const paymentRequest = await this.repo.create({
      dto,
      receiverUserId: receiver.id,
    });

    return toResponseDto(paymentRequest);
  }

  /** SRV-040: Retrieve by internal UUID for the authenticated owner. */
  async findById(
    id: string,
    user: AuthenticatedUser,
  ): Promise<PaymentRequestResponseDto> {
    const receiver = await this.usersService.getUserBySupabaseId(
      user.supabaseUserId,
    );
    if (!receiver) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Payment request ${id} not found.`,
        code: 'PAYMENT_REQUEST_NOT_FOUND',
      });
    }
    const pr = await this.repo.findById(id, receiver.id);
    if (pr.receiverUserId !== receiver.id) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Payment request ${id} not found.`,
        code: 'PAYMENT_REQUEST_NOT_FOUND',
      });
    }
    return toResponseDto(pr);
  }
}
