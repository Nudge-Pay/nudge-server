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
const apiPrefix = process.env.API_PREFIX;
const probeUrl = `http://localhost:${port}/${apiPrefix}`;

console.log(`Starting smoke check for dist/main against ${probeUrl}...`);

// 2. Mock Prisma in child process via preload script
const preloadScript = path
  .resolve(__dirname, 'mock-prisma.js')
  .replace(/\\/g, '/');
const nodeOptions = process.env.NODE_OPTIONS
  ? `${process.env.NODE_OPTIONS} -r "${preloadScript}"`
  : `-r "${preloadScript}"`;

const childEnv = {
  ...process.env,
  NODE_OPTIONS: nodeOptions,
};

const child =
  process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', 'npm', 'run', 'start:prod'], {
        cwd: path.resolve(__dirname, '..'),
        env: childEnv,
        stdio: 'pipe',
      })
    : spawn('npm', ['run', 'start:prod'], {
        cwd: path.resolve(__dirname, '..'),
        env: childEnv,
        stdio: 'pipe',
      });

function terminateChild() {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    try {
      spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F'], {
        stdio: 'ignore',
      });
    } catch {
      child.kill('SIGTERM');
    }
  } else {
    child.kill('SIGTERM');
  }
}

let exited = false;
let exitCode = null;

child.stdout.on('data', (d) => process.stdout.write(d));
child.stderr.on('data', (d) => process.stderr.write(d));

child.on('exit', (code) => {
  exited = true;
  exitCode = code;
});

const startTime = Date.now();
const TIMEOUT_MS = 20000;

const poll = () => {
  if (exited) {
    console.error(
      `Smoke check failed: Process exited prematurely with code ${exitCode} before serving.`,
    );
    process.exit(1);
  }

  if (Date.now() - startTime > TIMEOUT_MS) {
    console.error(
      `Smoke check failed: Timeout (${TIMEOUT_MS}ms) waiting for ${probeUrl} to respond.`,
    );
    terminateChild();
    process.exit(1);
  }

  http
    .get(probeUrl, (res) => {
      console.log(`Received HTTP ${res.statusCode} response from ${probeUrl}.`);
      if (res.statusCode === 200 || res.statusCode === 401) {
        console.log(
          `Smoke boot check passed successfully with HTTP ${res.statusCode}!`,
        );
        terminateChild();
        process.exit(0);
      } else {
        console.error(
          `Smoke check failed: Unexpected HTTP status ${res.statusCode}.`,
        );
        terminateChild();
        process.exit(1);
      }
    })
    .on('error', () => {
      setTimeout(poll, 250);
    });
};

setTimeout(poll, 500);
