import { PrismaClient } from '@prisma/client';

// Singleton PrismaClient — prevents connection pool exhaustion
// from multiple PrismaClient instances across services
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export default prisma;