import { PrismaClient } from '@prisma/client'

// فال‌بک نام متغیرهای محیطی — برای سازگاری با Integration ساپابیس روی Vercel
// (آنها POSTGRES_URL / POSTGRES_URL_NON_POOLING تزریق می‌کنند؛ Prisma منتظر DATABASE_URL است)
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
