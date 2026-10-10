import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from '../src/config/env.validation';
import configuration from '../src/config/configuration';
import helmet from 'helmet';
import compression from 'compression';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StellarService } from '../src/stellar/stellar.service';
import type { Application as ExpressApplication } from 'express';

describe('AppController (e2e)', () => {
  let app: INestApplication<ExpressApplication>;
  let mockStellarService: { getHealth: jest.Mock };

  beforeEach(async () => {
    mockStellarService = {
      getHealth: jest.fn().mockResolvedValue({
        status: 'ok',
        network: 'testnet',
        horizon: { healthy: true, latestLedger: 12345 },
        rpc: { healthy: true, latestLedger: 12345 },
      }),
    };
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
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.use(compression());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalFilters(new HttpExceptionFilter());

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

  describe('GET /v1/health', () => {
    it('returns 200 without a bearer token and reports ok when dependencies are healthy', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        database: 'ok',
        stellar: {
          status: 'ok',
          network: 'testnet',
          horizon: { healthy: true, latestLedger: 12345 },
          rpc: { healthy: true, latestLedger: 12345 },
        },
      });
    });

    it('reports degraded when stellar service reports degraded', async () => {
      mockStellarService.getHealth.mockResolvedValueOnce({
        status: 'degraded',
        network: 'testnet',
        horizon: { healthy: false },
        rpc: { healthy: true, latestLedger: 12345 },
      });

      const response = await request(app.getHttpServer()).get('/v1/health');

      expect(response.status).toBe(200);
      const body = response.body as {
        status: string;
        database: string;
        stellar: { status: string };
      };
      expect(body.status).toBe('degraded');
      expect(body.database).toBe('ok');
      expect(body.stellar.status).toBe('degraded');
    });
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
