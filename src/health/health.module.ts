import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [StellarModule],
  controllers: [HealthController],
})
export class HealthModule {}
