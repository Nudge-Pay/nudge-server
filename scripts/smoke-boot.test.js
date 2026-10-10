const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const child = new EventEmitter();
  Object.assign(child, {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    pid: 123,
    exitCode: null,
    signalCode: null,
    kill: () => {
      child.stopped = true;
    },
  });
  const timers = [];
  const processMock = {
    env: {},
    execPath: process.execPath,
    exit(code) {
      this.exitCode = code;
    },
    stdout: { write() {} },
    stderr: { write() {} },
  };
  const state = { child, timers, process: processMock, probes: 0 };
  const request = new EventEmitter();
  request.setTimeout = () => {};
  request.destroy = () => {
    state.destroyed = true;
  };
  vm.runInNewContext(
    readFileSync(path.join(__dirname, 'smoke-boot.js'), 'utf8'),
    {
      __dirname,
      process: processMock,
      console: { log() {}, warn() {}, error() {} },
      setTimeout: (fn, ms) => {
        const timer = { fn, ms };
        timers.push(timer);
        return timer;
      },
      clearTimeout: (timer) => {
        if (timer) timer.cleared = true;
      },
      require: (name) => {
        if (name === 'child_process')
          return {
            spawn: (_cmd, _args, options) => {
              state.token = options.env.SMOKE_BOOT_TOKEN;
              return child;
            },
          };
        if (name === 'http')
          return {
            get: (_url, callback) => {
              state.probes++;
              state.respond = callback;
              return request;
            },
          };
        if (name.startsWith('ts-node') || name === '../test/env.setup')
          return {};
        return require(name);
      },
    },
  );
  state.ready = () => {
    child.stdout.emit(
      'data',
      Buffer.from('Server running on http://localhost:3000/v1'),
    );
    for (const timer of timers.filter(
      (timer) => timer.ms === 500 && !timer.cleared,
    ))
      timer.fn();
  };
  return state;
}

test('rejects a healthy response from an unrelated server', () => {
  const h = harness();
  h.ready();
  h.respond({ statusCode: 200, headers: {}, resume() {} });
  assert.equal(h.process.exitCode, 1);
  assert.equal(h.child.stopped, true);
});

test('accepts the compiled child response and cleans up the child', () => {
  const h = harness();
  h.ready();
  h.respond({
    statusCode: 401,
    headers: { 'x-smoke-boot-token': h.token },
    resume() {},
  });
  assert.equal(h.process.exitCode, 0);
  assert.equal(h.child.stopped, true);
  assert.equal(h.destroyed, true);
});

test('does not probe before startup and fails when startup stalls', () => {
  const h = harness();
  assert.equal(h.probes, 0);
  h.timers.find((timer) => timer.ms === 20000).fn();
  assert.equal(h.process.exitCode, 1);
  assert.equal(h.child.stopped, true);
});

test('enforces the overall deadline even when an HTTP request hangs', () => {
  const h = harness();
  h.ready();
  h.timers.find((timer) => timer.ms === 20000).fn();
  assert.equal(h.process.exitCode, 1);
  assert.equal(h.destroyed, true);
  assert.equal(h.child.stopped, true);
});

test('reports spawn failures without an uncaught error', () => {
  const h = harness();
  h.child.pid = undefined;
  h.child.emit('error', new Error('spawn failed'));
  assert.equal(h.process.exitCode, 1);
});
