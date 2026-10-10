import { ApiProperty } from '@nestjs/swagger';

export class WalletDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: 'wallet-uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'Stellar public key',
    example: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  })
  stellarPublicKey!: string;

  @ApiProperty({
    enum: ['TESTNET', 'MAINNET'],
  })
  network!: string;

  @ApiProperty({ example: true })
  isPrimary!: boolean;

  @ApiProperty({ example: 'iPhone 14', nullable: true })
  label?: string | null;
}

export class UserProfileDto {
  @ApiProperty({
    description: 'Internal user ID',
    example: 'user-uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'Supabase Auth user ID',
    example: 'supa-user-uuid',
  })
  supabaseUserId!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'John Doe',
    nullable: true,
  })
  displayName?: string | null;

  @ApiProperty({
    description: 'Linked wallets',
    type: [WalletDto],
  })
  wallets!: WalletDto[];

  @ApiProperty({
    description: 'Account creation timestamp',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt!: Date;
}
