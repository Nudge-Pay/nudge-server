import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../database/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import type { StellarHealthResult } from '../stellar/stellar.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: { $queryRaw: jest.Mock };
  let mockStellarService: { getHealth: jest.Mock };

  const healthyStellar: StellarHealthResult = {
    status: 'ok',
    network: 'testnet',
    horizon: { healthy: true, latestLedger: 12345 },
    rpc: { healthy: true, latestLedger: 12345 },
  };

  const degradedStellar: StellarHealthResult = {
    status: 'degraded',
    network: 'testnet',
    horizon: { healthy: false },
    rpc: { healthy: true, latestLedger: 12345 },
  };

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    mockStellarService = {
      getHealth: jest.fn().mockResolvedValue(healthyStellar),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StellarService, useValue: mockStellarService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns status ok when both database and stellar services are healthy', async () => {
    const res = await controller.getHealth();

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockStellarService.getHealth).toHaveBeenCalled();
    expect(res).toEqual({
      status: 'ok',
      database: 'ok',
      stellar: healthyStellar,
    });
  });

  it('returns status degraded when database probe fails without leaking connection errors', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(
      new Error(
        'connection to postgresql://postgres:secret@localhost:5432 failed',
      ),
    );

    const res = await controller.getHealth();

    expect(res.status).toBe('degraded');
    expect(res.database).toBe('degraded');
    expect(res.stellar).toEqual(healthyStellar);
    expect(JSON.stringify(res)).not.toContain('postgresql://');
    expect(JSON.stringify(res)).not.toContain('secret');
  });

  it('returns status degraded when stellar services are degraded', async () => {
    mockStellarService.getHealth.mockResolvedValue(degradedStellar);

    const res = await controller.getHealth();

    expect(res.status).toBe('degraded');
    expect(res.database).toBe('ok');
    expect(res.stellar.status).toBe('degraded');
  });
});
