// Mark only responses emitted by this smoke-test child process.
if (process.env.SMOKE_BOOT_TOKEN) {
  const { Server } = require('http');
  const emit = Server.prototype.emit;
  Server.prototype.emit = function (event, ...args) {
    if (event === 'request') {
      args[1].setHeader('x-smoke-boot-token', process.env.SMOKE_BOOT_TOKEN);
    }
    return emit.call(this, event, ...args);
  };
}

try {
  const { PrismaClient } = require('@prisma/client');
  PrismaClient.prototype['$connect'] = async () => {};
  PrismaClient.prototype['$disconnect'] = async () => {};
} catch {
  // Prisma client not available
}
