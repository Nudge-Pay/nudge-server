import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidationErrorDto {
  @ApiProperty({ example: 'PAYMENT_REQUEST_ASSET_UNSUPPORTED' })
  code: string;

  @ApiProperty({ example: 'asset must be one of: XLM, USDC.' })
  message: string;

  @ApiPropertyOptional({ example: 'asset' })
  field?: string;
}

export class ValidatePaymentRequestResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiPropertyOptional({
    description: 'Normalized payload returned only when valid=true.',
    type: 'object',
    additionalProperties: true,
  })
  normalized?: Record<string, unknown>;

  @ApiProperty({ type: [ValidationErrorDto] })
  errors: ValidationErrorDto[];
}
