import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

// فال‌بک نام متغیرهای محیطی — برای سازگاری با Integration ساپابیس روی Vercel
// (آنها POSTGRES_URL / POSTGRES_URL_NON_POOLING تزریق می‌کنند؛ Prisma منتظر DATABASE_URL است)
if (!process.env.DATABASE_URL && process.env.POSTGRES_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

/**
 * حالت دمو بدون هیچ متغیر محیطی (مثلاً دیپلوی Vercel بدون DATABASE_URL):
 * یک نسخه SQLite از پیش سیدشده (prisma/demo.db) در /tmp کپی می‌شود تا اپلیکیشن
 * بدون هیچ تنظیماتی بالا بیاید و ورود با یک کلیک روی نقش کار کند.
 * (داده‌های نوشته‌شده در این حالت موقتی/دمو هستند — برای دیتای واقعی DATABASE_URL
 * ساپابیس باید تنظیم شود؛ در آن صورت این مسیر هرگز فعال نمی‌شود.)
 */
function bootstrapDemoDatabase() {
  const target = '/tmp/mep-pms-demo.db';
  const candidates = [
    path.join(process.cwd(), 'prisma', 'demo.db'),
    path.join(process.cwd(), '..', 'prisma', 'demo.db'),
    path.join(process.cwd(), 'demo.db'),
  ];
  const source = candidates.find((p) => fs.existsSync(p));
  if (!source) {
    console.warn('[db] demo.db not found — looked in:', candidates.join(' , '));
    return;
  }
  try {
    // حذف WAL/SHM باقی‌مانده از اجراهای قبلی — ترکیب WAL قدیمی با دیتابیس تازه
    // باعث خرابی/بازگشت داده‌های قدیمی می‌شود
    for (const side of [target + '-wal', target + '-shm']) {
      if (fs.existsSync(side)) {
        try { fs.rmSync(side); } catch { /* بی‌اهمیت */ }
      }
    }
    fs.copyFileSync(source, target);
    console.log(`[db] demo database ready: ${source} → ${target}`);
  } catch (e) {
    console.warn('[db] demo database copy failed:', e);
  }
}

const dbUrl = (process.env.DATABASE_URL || '').trim();
if (!dbUrl) {
  process.env.DATABASE_URL = 'file:/tmp/mep-pms-demo.db';
  bootstrapDemoDatabase();
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
