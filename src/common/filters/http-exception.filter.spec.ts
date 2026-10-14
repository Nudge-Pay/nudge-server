import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import type { Request, Response } from 'express';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: Partial<Request>;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/v1/test',
      method: 'POST',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse as unknown as Response,
        getRequest: () => mockRequest as unknown as Request,
      }),
    } as unknown as ArgumentsHost;

    const logger = (
      filter as unknown as { logger: { error: jest.Mock; warn: jest.Mock } }
    ).logger;
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('produces INTERNAL_ERROR and logs stack for unexpected Error', () => {
    const error = new Error('Database pool connection timeout');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        errors: [],
        path: '/v1/test',
      }),
    );

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'POST /v1/test 500 — Internal server error',
      error.stack,
    );
    expect(loggerWarnSpy).not.toHaveBeenCalled();
  });

  it('produces NOT_FOUND and logs warning without stack for 404 HttpException', () => {
    const exception = new HttpException(
      'Resource not found',
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Resource not found',
        code: 'NOT_FOUND',
        errors: [],
        path: '/v1/test',
      }),
    );

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'POST /v1/test 404 — Resource not found',
    );
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('preserves custom code and validation errors from HttpException body', () => {
    const exception = new HttpException(
      {
        statusCode: 400,
        message: ['email must be an email', 'amount is required'],
        code: 'VALIDATION_FAILED',
      },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['email must be an email', 'amount is required'],
        code: 'VALIDATION_FAILED',
        errors: ['email must be an email', 'amount is required'],
      }),
    );
    expect(loggerWarnSpy).toHaveBeenCalled();
  });

  it('handles Prisma P2002 error with DUPLICATE_ENTRY', () => {
    const prismaError = {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    };

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        code: 'DUPLICATE_ENTRY',
      }),
    );
  });

  it('handles Prisma P2025 error with NOT_FOUND', () => {
    const prismaError = {
      name: 'PrismaClientKnownRequestError',
      code: 'P2025',
    };

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        code: 'NOT_FOUND',
      }),
    );
  });

  it('handles unknown Prisma error code with DB_ERROR', () => {
    const prismaError = {
      name: 'PrismaClientKnownRequestError',
      code: 'P9999',
    };

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'DB_ERROR',
      }),
    );
  });
});
