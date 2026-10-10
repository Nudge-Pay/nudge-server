import {
  INestApplication,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export interface ConfigureAppResult {
  nodeEnv: string;
  defaultVersion: string;
  origins: string[];
  swaggerEnabled: boolean;
}

export function configureApp(app: INestApplication): ConfigureAppResult {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';
  const corsOrigins = configService.get<string>('app.corsOrigins') ?? '';
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'v1';
  const defaultVersion = apiPrefix.startsWith('v')
    ? apiPrefix.slice(1)
    : apiPrefix;

  app.use(helmet());
  app.use(compression());

  const origins = corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableVersioning({ type: VersioningType.URI, defaultVersion });

  const swaggerEnabled = nodeEnv !== 'production';

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Vela API')
      .setDescription('Self-custodial Stellar P2P payments via NFC')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`/${apiPrefix}/docs`, app, document);
  }

  app.useGlobalFilters(new HttpExceptionFilter());

  return {
    nodeEnv,
    defaultVersion,
    origins,
    swaggerEnabled,
  };
}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const { swaggerEnabled } = configureApp(app);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'v1';

  await app.listen(port);

  Logger.log(
    `🚀 Server running on http://localhost:${port}/${apiPrefix}`,
    'Bootstrap',
  );
  if (swaggerEnabled) {
    Logger.log(
      `📚 Swagger docs at http://localhost:${port}/${apiPrefix}/docs`,
      'Bootstrap',
    );
  }
}

if (
  require.main === module ||
  (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID)
) {
  void bootstrap();
}
