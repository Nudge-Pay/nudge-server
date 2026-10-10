const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// 1. Preload environment variables matching test/env.setup.ts
try {
  require('ts-node/register/transpile-only');
  const setupEnv = require('../test/env.setup').default;
  if (typeof setupEnv === 'function') {
    setupEnv();
  }
} catch (err) {
  console.warn(
    'Could not load test/env.setup.ts directly, using fallback defaults:',
    err.message,
  );
}

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3000';
process.env.API_PREFIX = process.env.API_PREFIX || 'v1';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:8081';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/postgres';
process.env.DIRECT_URL =
  process.env.DIRECT_URL ||
  'postgresql://postgres:password@localhost:5432/postgres';
process.env.SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'secret';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'service_role';
process.env.STELLAR_NETWORK = process.env.STELLAR_NETWORK || 'testnet';
process.env.STELLAR_HORIZON_URL =
  process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
process.env.STELLAR_RPC_URL =
  process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
process.env.STELLAR_USDC_ISSUER =
  process.env.STELLAR_USDC_ISSUER ||
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
process.env.STELLAR_NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
process.env.WEBAUTHN_RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
process.env.WEBAUTHN_RP_NAME = process.env.WEBAUTHN_RP_NAME || 'Vela';
process.env.WEBAUTHN_ORIGIN =
  process.env.WEBAUTHN_ORIGIN || 'http://localhost:8081';
process.env.PAYMENT_SUBMIT_TIMEOUT_MS =
  process.env.PAYMENT_SUBMIT_TIMEOUT_MS || '300000';
process.env.PAYMENT_POLL_INTERVAL_MS =
  process.env.PAYMENT_POLL_INTERVAL_MS || '2000';
process.env.PAYMENT_POLL_MAX_ATTEMPTS =
  process.env.PAYMENT_POLL_MAX_ATTEMPTS || '30';
process.env.THROTTLE_TTL_MS = process.env.THROTTLE_TTL_MS || '60000';
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT || '100';

const port = process.env.PORT;
const smokeToken = require('crypto').randomUUID();
const probeUrl = `http://localhost:${port}/${process.env.API_PREFIX}`;
const child = spawn(
  process.execPath,
  ['-r', path.resolve(__dirname, 'mock-prisma.js'), 'dist/main.js'],
  {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, SMOKE_BOOT_TOKEN: smokeToken },
    stdio: 'pipe',
  },
);
let finished = false;
let ready = false;
let output = '';
let request;
let retry;
let killTimer;
const deadline = setTimeout(
  () => finish(1, 'Server startup timed out.'),
  20000,
);

function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(deadline);
  clearTimeout(retry);
  request?.destroy();
  console.log(message);
  process.exitCode = code;
  if (child.exitCode === null && child.signalCode === null && child.pid) {
    child.kill('SIGTERM');
    killTimer = setTimeout(() => child.kill('SIGKILL'), 2000);
  }
}

child.on('error', (err) => finish(1, `Could not start server: ${err.message}`));
child.on('exit', (code) => {
  clearTimeout(killTimer);
  if (!finished) finish(1, `Server exited before the probe completed: ${code}`);
});
child.stderr.on('data', (data) => process.stderr.write(data));
child.stdout.on('data', (data) => {
  process.stdout.write(data);
  output = (output + data.toString()).slice(-8192);
  // Bootstrap logs this after app.listen() resolves. An unrelated server on
  // the requested port must not make this smoke check pass.
  if (!ready && output.includes('Server running on http://localhost:')) {
    ready = true;
    poll();
  }
});

function poll() {
  if (finished) return;
  request = http.get(probeUrl, (res) => {
    res.resume();
    const ok =
      res.headers['x-smoke-boot-token'] === smokeToken &&
      (res.statusCode === 200 || res.statusCode === 401);
    finish(
      ok ? 0 : 1,
      `Smoke check ${ok ? 'passed' : 'failed'}: HTTP ${res.statusCode}.`,
    );
  });
  request.setTimeout(1000, () => request.destroy(new Error('Probe timed out')));
  request.on('error', () => {
    if (!finished) retry = setTimeout(poll, 250);
  });
}
