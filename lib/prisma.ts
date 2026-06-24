import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { getPgPoolOptions, getRuntimeDatabaseUrl } from "@/lib/db/connection";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function createPrismaClient() {
  const connectionString = getRuntimeDatabaseUrl();
  const pool = globalForPrisma.pgPool ?? new pg.Pool(getPgPoolOptions(connectionString));

  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

export type { Role, ActivityType, AppointmentStatus } from "@/generated/prisma/client";
