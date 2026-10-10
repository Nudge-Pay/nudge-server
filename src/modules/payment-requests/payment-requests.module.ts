import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentRequestsRepository } from './payment-requests.repository';

@Module({
  imports: [UsersModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService, PaymentRequestsRepository],
  exports: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
