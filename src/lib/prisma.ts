import { PrismaClient } from '@prisma/client';

const defaultDatabaseUrl =
  'postgresql://neondb_owner:npg_OEGPHuo29gfs@ep-round-grass-ayyjcquq-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = defaultDatabaseUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL || defaultDatabaseUrl,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
