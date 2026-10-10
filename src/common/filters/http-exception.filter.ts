import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface PrismaKnownRequestError {
  name: string;
  code: string;
}

function isPrismaKnownRequestError(
  value: unknown,
): value is PrismaKnownRequestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).name ===
      'PrismaClientKnownRequestError' &&
    typeof (value as Record<string, unknown>).code === 'string'
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.url;
    const method = request.method;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string | undefined;
    let errors: string[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (
        typeof responseBody === 'object' &&
        responseBody !== null &&
        'message' in responseBody
      ) {
        const body = responseBody as Record<string, unknown>;
        const rawMessage = body.message;

        if (Array.isArray(rawMessage)) {
          message = rawMessage.map((item) => String(item));
          errors = rawMessage.map((item) => String(item));
        } else if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else {
          message = String(rawMessage);
        }

        if (typeof body.code === 'string') {
          code = body.code;
        } else if (typeof body.error === 'string') {
          code = body.error.toUpperCase().replace(/\s+/g, '_');
        }
      }

      if (!code) {
        switch (status) {
          case HttpStatus.BAD_REQUEST:
            code = 'BAD_REQUEST';
            break;
          case HttpStatus.NOT_FOUND:
            code = 'NOT_FOUND';
            break;
          case HttpStatus.CONFLICT:
            code = 'CONFLICT';
            break;
          case HttpStatus.UNAUTHORIZED:
            code = 'UNAUTHORIZED';
            break;
          case HttpStatus.FORBIDDEN:
            code = 'FORBIDDEN';
            break;
        }
      }
    } else if (isPrismaKnownRequestError(exception)) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists';
          code = 'DUPLICATE_ENTRY';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          code = 'NOT_FOUND';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Database error';
          code = 'DB_ERROR';
      }
    }

    if (!code) {
      code = 'INTERNAL_ERROR';
    }

    const logMessage = `${method} ${path} ${status} — ${
      Array.isArray(message) ? message.join(', ') : message
    }`;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(logMessage, stack);
    } else {
      this.logger.warn(logMessage);
    }

    response.status(status).json({
      statusCode: status,
      message,
      code,
      errors,
      timestamp: new Date().toISOString(),
      path,
    });
  }
}
