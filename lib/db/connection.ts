/**
 * Supabase + Prisma runtime connection helpers.
 *
 * Runtime (Vercel/serverless): DATABASE_URL → Transaction pooler, port 6543
 *   postgresql://postgres.[project-ref]:[password]@aws-[n]-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
 *
 * Prisma CLI (migrate/push/seed): DIRECT_URL → Direct connection, port 5432
 *   postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
 *
 * "Tenant or user not found" almost always means wrong pooler host (aws-0 vs aws-1)
 * or username is `postgres` instead of `postgres.[project-ref]`. Copy both URLs
 * from Supabase Dashboard → Project Settings → Database.
 */
export function normalizeSupabaseDatabaseUrl(connectionString: string) {
  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL connection URL");
  }

  if (url.hostname.includes("pooler.supabase.com")) {
    if (!url.username.includes(".")) {
      throw new Error(
        "Supabase pooler DATABASE_URL must use username postgres.[project-ref], not postgres. Copy the Transaction pooler string from Supabase Dashboard.",
      );
    }

    if (url.port && url.port !== "6543") {
      console.warn(
        `[db] DATABASE_URL uses pooler host on port ${url.port}. Supabase transaction pooler should use port 6543 for serverless/Vercel.`,
      );
    }

    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
  }

  return url.toString();
}

export function getRuntimeDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return normalizeSupabaseDatabaseUrl(connectionString);
}

export function getPgPoolOptions(connectionString: string) {
  const isSupabase = connectionString.includes("supabase.com");

  return {
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? "1" : "10")),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
  } satisfies import("pg").PoolConfig;
}
