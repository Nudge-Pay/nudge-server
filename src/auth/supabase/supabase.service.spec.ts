import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import * as jwt from 'jsonwebtoken';

describe('SupabaseService', () => {
  let service: SupabaseService;

  const testSecret = 'test-secret-key-for-jwt-verification';

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          'supabase.jwtSecret': testSecret,
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should verify a valid JWT token', () => {
    const payload = {
      sub: 'test-user-id',
      email: 'test@example.com',
      email_verified: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = jwt.sign(payload, testSecret, { algorithm: 'HS256' });

    const result = service.verifyToken(token);
    expect(result).toBeDefined();
    expect(result.sub).toBe('test-user-id');
    expect(result.email).toBe('test@example.com');
  });

  it('should throw on invalid JWT token', () => {
    const invalidToken = 'invalid.token.here';
    expect(() => service.verifyToken(invalidToken)).toThrow();
  });

  it('should extract user claims from JWT', () => {
    const payload = {
      sub: 'user-123',
      email: 'user@example.com',
      email_verified: false,
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = jwt.sign(payload, testSecret, { algorithm: 'HS256' });

    const claims = service.verifyToken(token);
    expect(claims.sub).toBe('user-123');
    expect(claims.email).toBe('user@example.com');
    expect(claims.email_verified).toBe(false);
  });

  it('should throw on expired token', () => {
    const expiredPayload = {
      sub: 'user-123',
      email: 'user@example.com',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const token = jwt.sign(expiredPayload, testSecret, { algorithm: 'HS256' });

    expect(() => service.verifyToken(token)).toThrow('JWT token expired');
  });

  describe('algorithm allow-list and clock-tolerance (#106)', () => {
    it('should reject a token signed with HS512 using the same secret', () => {
      const payload = {
        sub: 'user-hs512',
        email: 'hs512@example.com',
        aud: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = jwt.sign(payload, testSecret, { algorithm: 'HS512' });

      expect(() => service.verifyToken(token)).toThrow('Invalid JWT token');
    });

    it('should accept a token expired 4 minutes ago under 5-minute clock tolerance', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: 'user-tolerance-4m',
        email: 'tolerance4m@example.com',
        aud: 'authenticated',
        iat: now - 3600,
        exp: now - 4 * 60,
      };
      const token = jwt.sign(payload, testSecret, { algorithm: 'HS256' });

      const result = service.verifyToken(token);
      expect(result).toBeDefined();
      expect(result.sub).toBe('user-tolerance-4m');
      expect(result.email).toBe('tolerance4m@example.com');
    });

    it('should reject a token expired 6 minutes ago exceeding 5-minute clock tolerance', () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        sub: 'user-tolerance-6m',
        email: 'tolerance6m@example.com',
        aud: 'authenticated',
        iat: now - 3600,
        exp: now - 6 * 60,
      };
      const token = jwt.sign(payload, testSecret, { algorithm: 'HS256' });

      expect(() => service.verifyToken(token)).toThrow('JWT token expired');
    });

    it('should distinguish errors between malformed and expired tokens', () => {
      const malformedToken = 'malformed.token.payload';
      expect(() => service.verifyToken(malformedToken)).toThrow(
        'Invalid JWT token',
      );

      const now = Math.floor(Date.now() / 1000);
      const expiredPayload = {
        sub: 'user-distinguish-test',
        email: 'distinguish@example.com',
        iat: now - 7200,
        exp: now - 3600,
      };
      const expiredToken = jwt.sign(expiredPayload, testSecret, {
        algorithm: 'HS256',
      });

      expect(() => service.verifyToken(expiredToken)).toThrow(
        'JWT token expired',
      );
    });
  });
});
