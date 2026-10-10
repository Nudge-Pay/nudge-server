import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from '../src/config/env.validation';
import configuration from '../src/config/configuration';
import { configureApp } from '../src/main';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import type { Application as ExpressApplication } from 'express';

describe('AppController (e2e)', () => {
  let app: INestApplication<ExpressApplication>;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.API_PREFIX = 'v1';
    process.env.CORS_ORIGINS = 'http://localhost:8081';
    process.env.DATABASE_URL =
      'postgresql://postgres:password@localhost:5432/postgres';
    process.env.DIRECT_URL =
      'postgresql://postgres:password@localhost:5432/postgres';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_JWT_SECRET = 'secret';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role';
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.STELLAR_HORIZON_URL = 'https://horizon-testnet.stellar.org';
    process.env.STELLAR_RPC_URL = 'https://soroban-testnet.stellar.org';
    process.env.STELLAR_USDC_ISSUER =
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    process.env.STELLAR_NETWORK_PASSPHRASE =
      'Test SDF Network ; September 2015';
    process.env.WEBAUTHN_RP_ID = 'localhost';
    process.env.WEBAUTHN_RP_NAME = 'Vela';
    process.env.WEBAUTHN_ORIGIN = 'http://localhost:8081';
    process.env.PAYMENT_SUBMIT_TIMEOUT_MS = '300000';
    process.env.PAYMENT_POLL_INTERVAL_MS = '2000';
    process.env.PAYMENT_POLL_MAX_ATTEMPTS = '30';
    process.env.THROTTLE_TTL_MS = '60000';
    process.env.THROTTLE_LIMIT = '100';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envValidationSchema,
          validationOptions: { abortEarly: false, allowUnknown: false },
          load: [configuration],
        }),
        AppModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    await app.init();
  });

  it('should return JSON 404 for an unknown route', async () => {
    const response = await request(app.getHttpServer()).get('/v1/nonexistent');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Cannot GET /v1/nonexistent',
      code: 'NOT_FOUND',
      errors: [],
      path: '/v1/nonexistent',
    });

    const body = response.body as { timestamp?: unknown };
    expect(typeof body.timestamp).toBe('string');
  });

  it('should initialize the server with valid environment variables', () => {
    expect(app).toBeDefined();
    expect(app.getHttpServer()).toBeDefined();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
