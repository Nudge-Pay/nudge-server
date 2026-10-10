import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import type { StellarHealthResult } from '../stellar/stellar.service';

export interface HealthResponseDto {
  status: 'ok' | 'degraded';
  database: 'ok' | 'degraded';
  stellar: StellarHealthResult;
}

@ApiTags('health')
@Controller({ path: 'health', version: [VERSION_NEUTRAL, '1'] })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellarService: StellarService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health probe',
    description:
      'Public probe checking server, database, and Stellar Horizon/RPC connectivity.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status response (always HTTP 200).',
  })
  async getHealth(): Promise<HealthResponseDto> {
    let database: 'ok' | 'degraded' = 'degraded';
    try {
      if (typeof this.prisma.$queryRaw === 'function') {
        await this.prisma.$queryRaw`SELECT 1`;
      }
      database = 'ok';
    } catch {
      database = 'degraded';
    }

    const stellar = await this.stellarService.getHealth();
    const overallStatus =
      database === 'ok' && stellar.status === 'ok' ? 'ok' : 'degraded';

    return {
      status: overallStatus,
      database,
      stellar,
    };
  }
}
