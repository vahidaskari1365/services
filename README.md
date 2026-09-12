# 🏗️ مپ‌پی‌ام‌اس (MEP-PMS)

**سامانه یکپارچه مدیریت پروژه و اتوماسیون تأسیسات ساختمانی** — پیاده‌سازی کامل SOW با Next.js 16، آماده دیپلوی روی Vercel با دیتابیس Supabase.

## ✨ ماژول‌ها

| ماژول | شرح |
|---|---|
| 🎯 داشبورد و BI | KPI، نمودارهای تعاملی، رادار گلوگاه پروژه‌ها، هشدار چک‌ها |
| ✅ مرکز عملیات | کارتابل تاییدها با تأیید یک‌کلیکی و رد دلیل‌دار |
| 📁 پروژه‌ها و قراردادها | قرارداد دستمزدی / مصالح‌دار، **سد سخت تراز مصالح** قبل از تسویه (HTTP 423) |
| 👷 اشخاص و اکیپ‌ها | سرپرست، اکیپ، بازاریاب، چک ضمانت |
| 🧮 موتور محاسبات | تعرفه سرپرست (مقطوع / متراژی / بازدیدی / تنخواه)، پورسانت پلکانی بازاریاب (۲ تا ۵٪) |
| 📬 پیگیری هوشمند | ارجاع خودکار اقساط معوق (۴۸/۹۶ ساعت) و وظایف (۲۴ ساعت) به کارتابل منشی، پیامک پترن‌دار |
| 💳 هاب مالی | اقساط، لینک پرداخت آنلاین (شبیه‌سازی شاپرک)، همگام‌سازی نرم‌افزار حسابداری |
| 📊 گزارش سود و زیان | تفکیکی بر اساس پروژه / رسته / بازاریاب |
| ⚙️ تنظیمات | آستانه‌ها، پلکان پورسانت، قالب پیامک، RBAC کامل از پنل |

**امکانات UI:** راست‌چین کامل، فونت وزیرمتن، تاریخ شمسی، اعداد فارسی با جداکننده ۳رقمی (`۵۰٬۰۰۰٬۰۰۰`)، **تم تاریک/روشن**، کاملاً ریسپانسیو (PWA-ready).

## 🛠 تکنولوژی

- **Next.js 16** (App Router) + TypeScript
- **Prisma** — SQLite برای توسعه محلی، PostgreSQL برای تولید
- **Supabase** (PostgreSQL) — دیتابیس ابری تولید
- **shadcn/ui + Tailwind CSS 4** + Recharts + Zustand
- Auth دستی (scrypt + HMAC cookie) و RBAC با ۲۸ مجوز / ۶ نقش

## 🚀 اجرای محلی

```bash
cp .env.example .env        # DATABASE_URL فایل SQLite پیش‌فرض است
bun install
bun run db:push             # ساخت جداول SQLite
bun run db:seed             # داده دمو (۶ کاربر، ۳ پروژه، قرارداد، اقساط…)
bun run dev                 # http://localhost:3000
```

**حساب‌های دمو** (رمز همه: `1234`):
`manager` · `secretary` · `supervisor` · `accountant` · `marketer` · `team`

## 🗄 راه‌اندازی دیتابیس Supabase

1. وارد داشبورد [Supabase](https://supabase.com) شوید و پروژه `kioqbtldumiuwkfdclhn` را باز کنید.
2. از منوی کنار **SQL Editor** را باز کنید و **New query** بزنید.
3. کل محتوای فایل [`supabase/schema.sql`](supabase/schema.sql) را paste کنید و **Run** بزنید.
   - ✅ ۳۲ جدول + کلیدهای خارجی + ایندکس‌ها + Row Level Security ساخته می‌شود.
4. (اختیاری — داده دمو روی ساپابیس) با رشته اتصال مستقیم:
   ```bash
   DATABASE_URL="postgresql://postgres.kioqbtldumiuwkfdclhn:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" \
   bun run db:push:pg && bunx prisma generate --schema prisma/schema.postgres.prisma && bun run db:seed
   ```

> 🔒 RLS فعال است: دسترسی REST با کلید publishable بسته و فقط `service_role` و اتصال مستقیم Prisma دسترسی دارند.

## ▲ دیپلوی روی Vercel

1. روی [vercel.com/new](https://vercel.com/new) ریپو را Import کنید (نیازی به تنظیمات خاص نیست).
2. قبل از Deploy، در بخش **Environment Variables** متغیر `DATABASE_URL` را با رشته **Connection Pooling** ساپابیس (پورت `6543` همراه `?pgbouncer=true&connection_limit=1`) تنظیم کنید — نمونه در [`.env.example`](.env.example).
3. Deploy بزنید. اسکریپت `postinstall` به‌صورت خودکار کلاینت Prisma را با اسکیمای PostgreSQL می‌سازد.
4. (اختیاری) `DIRECT_URL` را برای مهاجرت‌ها اضافه کنید.

> ⚠️ جداول باید یک‌بار طبق بخش قبل در SQL Editor ساخته شده باشند.

## 📁 ساختار

```
prisma/schema.prisma            ← اسکیمای SQLite (توسعه محلی)
prisma/schema.postgres.prisma   ← اسکیمای PostgreSQL (تولید)
supabase/schema.sql             ← DDL کامل برای Supabase SQL Editor
scripts/seed.ts                 ← داده دمو
scripts/postinstall.cjs         ← انتخاب خودکار اسکیمای Prisma
src/app/api/                    ← ~۲۰ Route (پروژه، قرارداد، تایید، اقساط، پیامک…)
src/components/app/             ← UI کامل RTL (SPA تک‌مسیر با Zustand)
src/lib/engines/                ← موتور تعرفه، پورسانت، سد سخت، ارجاع
```

## 🔧 اسکریپت‌ها

| دستور | کار |
|---|---|
| `bun run dev` | اجرای توسعه |
| `bun run build` / `start` | بیلد تولید / اجرا |
| `bun run db:push` | اعمال اسکیما به SQLite |
| `bun run db:push:pg` | اعمال اسکیما به PostgreSQL |
| `bun run db:seed` | داده دمو |
| `bun run lint` | بررسی کیفیت کد |
