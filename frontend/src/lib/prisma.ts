import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaPool: Pool | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool =
    globalForPrisma.prismaPool ??
    new Pool({
      connectionString,
      max: process.env.NODE_ENV === "production" ? 10 : 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });

  pool.on("error", (error) => {
    console.error("Postgres pool error:", error);
  });

  globalForPrisma.prismaPool = pool;

  const adapter = new PrismaPg(pool, {
    onPoolError: (error) => {
      console.error("Prisma Postgres adapter error:", error);
    },
  });
  return new PrismaClient({ adapter });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
