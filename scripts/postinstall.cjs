/**
 * postinstall — انتخاب اسکیمای Prisma بر اساس نوع دیتابیس
 * اگر DATABASE_URL از نوع postgres باشد (Vercel + Supabase) از اسکیمای postgres
 * و در غیر این صورت (اجرای محلی/سندباکس) از اسکیمای sqlite استفاده می‌شود.
 */
const { execSync } = require("child_process");

const url = process.env.DATABASE_URL || "";
const isPostgres = url.startsWith("postgres") || url.startsWith("postgresql");

const cmd = isPostgres
  ? "prisma generate --schema prisma/schema.postgres.prisma"
  : "prisma generate";

console.log(`[postinstall] ${isPostgres ? "PostgreSQL (Supabase)" : "SQLite"} schema detected → ${cmd}`);
execSync(cmd, { stdio: "inherit" });
