import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new pg.Pool({
    connectionString,
    ssl: connectionString.includes("supabase.com") ? { rejectUnauthorized: false } : undefined,
  });
}

function createPrismaClient() {
  const pool = globalForPrisma.pgPool ?? createPool();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type { Role, ActivityType, AppointmentStatus } from "@/generated/prisma/client";
