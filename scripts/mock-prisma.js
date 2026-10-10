try {
  const { PrismaClient } = require('@prisma/client');
  PrismaClient.prototype['$connect'] = async () => {};
  PrismaClient.prototype['$disconnect'] = async () => {};
} catch {
  // Prisma client not available
}
