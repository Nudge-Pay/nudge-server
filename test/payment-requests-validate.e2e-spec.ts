import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from '../src/config/env.validation';
import configuration from '../src/config/configuration';
import { configureApp } from '../src/main';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import type { Application as ExpressApplication } from 'express';

const VALIDATE_ROUTE = '/v1/payment-requests/validate';

interface ValidationBody {
  valid: boolean;
  normalized?: Record<string, unknown>;
  errors: Array<{ code: string }>;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    type: 'payment-request',
    version: 1,
    recipient: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    asset: 'USDC',
    amount: '25.00',
    timestamp: new Date(now).toISOString(),
    expiresAt: new Date(now + 30_000).toISOString(),
    ...overrides,
  };
}

describe('PaymentRequests validate (e2e)', () => {
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

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('accepts a valid USDC payload without authentication', async () => {
    const response = await request(app.getHttpServer())
      .post(VALIDATE_ROUTE)
      .send(validPayload());

    const body = response.body as ValidationBody;
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ valid: true, errors: [] });
    expect(body.normalized).toMatchObject({ asset: 'USDC' });
  });

  it('rejects an unsupported asset with 200 and an asset error code', async () => {
    const response = await request(app.getHttpServer())
      .post(VALIDATE_ROUTE)
      .send(validPayload({ asset: 'BTC' }));

    const body = response.body as ValidationBody;
    expect(response.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ code: 'PAYMENT_REQUEST_ASSET_UNSUPPORTED' }),
    );
  });

  it('rejects a non-Stellar recipient', async () => {
    const response = await request(app.getHttpServer())
      .post(VALIDATE_ROUTE)
      .send(validPayload({ recipient: '0x1234567890abcdef' }));

    const body = response.body as ValidationBody;
    expect(response.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ code: 'PAYMENT_REQUEST_RECIPIENT_INVALID' }),
    );
  });

  it('rejects an expiresAt in the past', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const response = await request(app.getHttpServer())
      .post(VALIDATE_ROUTE)
      .send(validPayload({ expiresAt: past }));

    const body = response.body as ValidationBody;
    expect(response.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContainEqual(
      expect.objectContaining({
        code: 'PAYMENT_REQUEST_EXPIRES_AT_OUT_OF_WINDOW',
      }),
    );
  });

  it('rejects unknown fields with 200 instead of a pipe 400', async () => {
    const response = await request(app.getHttpServer())
      .post(VALIDATE_ROUTE)
      .send({ ...validPayload(), unexpected: true });

    const body = response.body as ValidationBody;
    expect(response.status).toBe(200);
    expect(body.valid).toBe(false);
    expect(body.errors).toContainEqual(
      expect.objectContaining({ code: 'PAYMENT_REQUEST_FIELD_UNKNOWN' }),
    );
  });
});
