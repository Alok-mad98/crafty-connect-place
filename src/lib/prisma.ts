/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Prisma 7 generates ESM output. We use a dynamic require workaround for Next.js compatibility.
let PrismaClient: any;
try {
  // Try the standard @prisma/client first (works if prisma generate sets up the default location)
  PrismaClient = require("@prisma/client").PrismaClient;
} catch {
  // Fallback - shouldn't happen in production
  PrismaClient = class MockPrismaClient {
    skill = { findMany: async () => [], findUnique: async () => null, create: async (d: any) => d.data, update: async (d: any) => d.data };
    user = { findUnique: async () => null, upsert: async (d: any) => d.create };
    purchase = { findUnique: async () => null, findMany: async () => [], create: async (d: any) => d.data };
  };
}

const globalForPrisma = globalThis as unknown as { prisma: any };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
