import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Horizon, rpc } from '@stellar/stellar-sdk';
import { StellarModule } from './stellar.module';
import {
  STELLAR_HORIZON_SERVER,
  STELLAR_NETWORK_CONFIG,
  STELLAR_RPC_SERVER,
  type StellarNetworkConfig,
} from './stellar.constants';
import { StellarService } from './stellar.service';

describe('StellarModule', () => {
  const validConfig: Record<string, string | number> = {
    'stellar.network': 'testnet',
    'stellar.horizonUrl': 'https://horizon-testnet.stellar.org',
    'stellar.rpcUrl': 'https://soroban-testnet.stellar.org',
    'stellar.usdcIssuer':
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    'stellar.networkPassphrase': 'Test SDF Network ; September 2015',
    'payments.submitTimeoutMs': 300_000,
    'payments.pollIntervalMs': 2_000,
    'payments.pollMaxAttempts': 30,
  };

  function createTestModule(
    configMap: Record<string, string | number>,
  ): Promise<TestingModule> {
    const configServiceMock = {
      getOrThrow: jest.fn((key: string) => {
        if (key in configMap) {
          return configMap[key];
        }
        throw new Error(`Configuration key "${key}" not found.`);
      }),
      get: jest.fn((key: string) => configMap[key]),
    };

    return Test.createTestingModule({
      imports: [StellarModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configServiceMock)
      .compile();
  }

  it('resolves STELLAR_NETWORK_CONFIG with the configured values', async () => {
    const module = await createTestModule(validConfig);
    const networkConfig = module.get<StellarNetworkConfig>(
      STELLAR_NETWORK_CONFIG,
    );

    expect(networkConfig).toEqual({
      network: 'testnet',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
  });

  it('resolves STELLAR_HORIZON_SERVER and STELLAR_RPC_SERVER as valid instances', async () => {
    const module = await createTestModule(validConfig);
    const horizonServer = module.get<Horizon.Server>(STELLAR_HORIZON_SERVER);
    const rpcServer = module.get<rpc.Server>(STELLAR_RPC_SERVER);
    const stellarService = module.get<StellarService>(StellarService);

    expect(horizonServer).toBeInstanceOf(Horizon.Server);
    expect(rpcServer).toBeInstanceOf(rpc.Server);
    expect(stellarService).toBeInstanceOf(StellarService);
  });

  it('fails module compilation when stellar.networkPassphrase is missing', async () => {
    const incompleteConfig = { ...validConfig };
    delete incompleteConfig['stellar.networkPassphrase'];

    await expect(createTestModule(incompleteConfig)).rejects.toThrow(
      'Configuration key "stellar.networkPassphrase" not found.',
    );
  });
});
