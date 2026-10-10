import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database';
import { AuthModule } from './auth/auth.module';
import { SupabaseAuthGuard } from './auth/guards/supabase-auth.guard';
import { PaymentRequestsModule } from './modules/payment-requests/payment-requests.module';
import { WebAuthnModule } from './webauthn/webauthn.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StellarModule } from './stellar/stellar.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: false,
      },
      load: [configuration],
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    PaymentRequestsModule,
    WebAuthnModule,
    PaymentsModule,
    StellarModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
})
export class AppModule {}
