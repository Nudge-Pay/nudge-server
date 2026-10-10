import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { configureApp } from './main';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

jest.mock('./app.module', () => ({ AppModule: class MockAppModule {} }));

interface MockApp {
  get: jest.Mock;
  use: jest.Mock;
  enableCors: jest.Mock;
  useGlobalPipes: jest.Mock;
  enableVersioning: jest.Mock;
  useGlobalFilters: jest.Mock;
}

describe('configureApp', () => {
  let mockApp: MockApp;
  let mockConfigService: { get: jest.Mock };
  let createDocumentSpy: jest.SpyInstance;
  let setupSpy: jest.SpyInstance;

  const runConfigureApp = () =>
    configureApp(mockApp as unknown as INestApplication);

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'app.nodeEnv':
            return 'development';
          case 'app.corsOrigins':
            return 'http://localhost:3000';
          case 'app.apiPrefix':
            return 'v1';
          default:
            return undefined;
        }
      }),
    };

    mockApp = {
      get: jest.fn().mockImplementation((token: unknown) => {
        if (token === ConfigService) {
          return mockConfigService;
        }
        return undefined;
      }),
      use: jest.fn().mockReturnThis(),
      enableCors: jest.fn().mockReturnThis(),
      useGlobalPipes: jest.fn().mockReturnThis(),
      enableVersioning: jest.fn().mockReturnThis(),
      useGlobalFilters: jest.fn().mockReturnThis(),
    };

    createDocumentSpy = jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Vela API', version: '1.0' },
        paths: {},
      });
    setupSpy = jest
      .spyOn(SwaggerModule, 'setup')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ValidationPipe configuration', () => {
    it('registers global ValidationPipe with whitelist, forbidNonWhitelisted, and transform options', () => {
      runConfigureApp();

      expect(mockApp.useGlobalPipes).toHaveBeenCalledTimes(1);
      const firstPipeCall = mockApp.useGlobalPipes.mock.calls[0] as unknown as [
        ValidationPipe,
      ];
      const pipe = firstPipeCall[0];
      expect(pipe).toBeInstanceOf(ValidationPipe);

      // Access internal options of ValidationPipe
      const validatorOptions = (
        pipe as unknown as { validatorOptions: Record<string, unknown> }
      ).validatorOptions;
      const isTransformEnabled = (
        pipe as unknown as { isTransformEnabled: boolean }
      ).isTransformEnabled;
      const transformOptions = (
        pipe as unknown as { transformOptions: Record<string, unknown> }
      ).transformOptions;

      expect(validatorOptions.whitelist).toBe(true);
      expect(validatorOptions.forbidNonWhitelisted).toBe(true);
      expect(isTransformEnabled).toBe(true);
      expect(transformOptions.enableImplicitConversion).toBe(true);
    });
  });

  describe('CORS origins configuration', () => {
    it("produces none (empty array) when CORS_ORIGINS is ''", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.corsOrigins') return '';
        return undefined;
      });

      const result = runConfigureApp();

      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: [],
        credentials: true,
      });
      expect(result.origins).toEqual([]);
    });

    it("produces ['a'] when CORS_ORIGINS is 'a'", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.corsOrigins') return 'a';
        return undefined;
      });

      const result = runConfigureApp();

      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: ['a'],
        credentials: true,
      });
      expect(result.origins).toEqual(['a']);
    });

    it("produces exactly two trimmed origins ['a', 'b'] when CORS_ORIGINS is 'a, b'", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.corsOrigins') return 'a, b';
        return undefined;
      });

      const result = runConfigureApp();

      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: ['a', 'b'],
        credentials: true,
      });
      expect(result.origins).toEqual(['a', 'b']);
    });

    it('correctly filters out whitespace and empty entries from comma-separated list', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.corsOrigins') {
          return '  http://localhost:3000 , , https://app.example.com  ';
        }
        return undefined;
      });

      const result = runConfigureApp();

      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: ['http://localhost:3000', 'https://app.example.com'],
        credentials: true,
      });
      expect(result.origins).toEqual([
        'http://localhost:3000',
        'https://app.example.com',
      ]);
    });
  });

  describe('URI versioning configuration', () => {
    it("derives defaultVersion '1' from apiPrefix 'v1'", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.apiPrefix') return 'v1';
        return undefined;
      });

      const result = runConfigureApp();

      expect(mockApp.enableVersioning).toHaveBeenCalledWith({
        type: VersioningType.URI,
        defaultVersion: '1',
      });
      expect(result.defaultVersion).toBe('1');
    });

    it("derives defaultVersion '2' from apiPrefix 'v2'", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.apiPrefix') return 'v2';
        return undefined;
      });

      const result = runConfigureApp();

      expect(mockApp.enableVersioning).toHaveBeenCalledWith({
        type: VersioningType.URI,
        defaultVersion: '2',
      });
      expect(result.defaultVersion).toBe('2');
    });

    it("uses exact apiPrefix when prefix does not start with 'v'", () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.apiPrefix') return 'api';
        return undefined;
      });

      const result = runConfigureApp();

      expect(mockApp.enableVersioning).toHaveBeenCalledWith({
        type: VersioningType.URI,
        defaultVersion: 'api',
      });
      expect(result.defaultVersion).toBe('api');
    });
  });

  describe('Swagger documentation gate', () => {
    it('disables Swagger when NODE_ENV=production', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.nodeEnv') return 'production';
        if (key === 'app.apiPrefix') return 'v1';
        return undefined;
      });

      const result = runConfigureApp();

      expect(result.swaggerEnabled).toBe(false);
      expect(createDocumentSpy).not.toHaveBeenCalled();
      expect(setupSpy).not.toHaveBeenCalled();
    });

    it('enables Swagger when NODE_ENV is development', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.nodeEnv') return 'development';
        if (key === 'app.apiPrefix') return 'v1';
        return undefined;
      });

      const result = runConfigureApp();

      expect(result.swaggerEnabled).toBe(true);
      expect(createDocumentSpy).toHaveBeenCalledTimes(1);
      expect(setupSpy).toHaveBeenCalledWith(
        '/v1/docs',
        mockApp,
        expect.any(Object),
      );
    });

    it('enables Swagger when NODE_ENV is test or staging', () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'app.nodeEnv') return 'staging';
        if (key === 'app.apiPrefix') return 'v2';
        return undefined;
      });

      const result = runConfigureApp();

      expect(result.swaggerEnabled).toBe(true);
      expect(createDocumentSpy).toHaveBeenCalledTimes(1);
      expect(setupSpy).toHaveBeenCalledWith(
        '/v2/docs',
        mockApp,
        expect.any(Object),
      );
    });
  });

  describe('Middlewares and global filters', () => {
    it('registers helmet, compression, and HttpExceptionFilter', () => {
      runConfigureApp();

      expect(mockApp.use).toHaveBeenCalledTimes(2); // helmet() and compression()
      expect(mockApp.useGlobalFilters).toHaveBeenCalledTimes(1);
      const firstFilterCall = mockApp.useGlobalFilters.mock
        .calls[0] as unknown as [unknown];
      const filter = firstFilterCall[0];
      expect(filter).toBeInstanceOf(HttpExceptionFilter);
    });
  });
});
