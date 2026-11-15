import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "./env";

/**
 * Single Prisma client per server instance. In development the client is kept on
 * globalThis so hot reloads do not open a new connection pool each time.
 * Only repositories (and this file) may import the Prisma client.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: getEnv().DATABASE_URL });
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/** Either the client or an open transaction; repositories accept both. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Runs several repository calls in one database transaction. */
export function inTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return getDb().$transaction(work);
}

/** True when an error is a unique-constraint violation (optionally on a given field). */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}
