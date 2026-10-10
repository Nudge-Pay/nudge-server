import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidatePaymentRequestDto {
  @ApiProperty({
    description: 'Full payment-request.v1 payload as a JSON object.',
    example: {
      type: 'payment-request',
      version: 1,
      recipient: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      asset: 'USDC',
      amount: '25.00',
      timestamp: '2026-06-17T12:00:00.000Z',
      expiresAt: '2026-06-17T12:00:30.000Z',
    },
  })
  payload: unknown;
}

export class ValidationErrorDto {
  @ApiProperty({ example: 'PAYMENT_REQUEST_ASSET_UNSUPPORTED' })
  code!: string;

  @ApiProperty({ example: 'asset must be one of: XLM, USDC.' })
  message!: string;

  @ApiPropertyOptional({ example: 'asset' })
  field?: string;
}

export class ValidatePaymentRequestResponseDto {
  @ApiProperty({ example: true })
  valid!: boolean;

  @ApiPropertyOptional({
    description: 'Normalized payload returned only when valid=true.',
    type: 'object',
    additionalProperties: true,
  })
  normalized?: Record<string, unknown>;

  @ApiProperty({ type: [ValidationErrorDto] })
  errors!: ValidationErrorDto[];
}
