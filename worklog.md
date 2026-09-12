# Worklog — MEP-PMS Project

---
Task ID: 1
Agent: main (Super Z)
Task: نصب اسکیل‌های GitHub، خواندن SOW، طراحی دیتابیس و موتورهای محاسباتی

Work Log:
- کلون ۶ ریپو در /home/z/my-project/external-skills/: claude-seo (۳۰ اسکیل SEO)، ruflo (ارکستراسیون multi-agent)، freellmapi (گیت‌وی LLM رایگان)، mattpocock-skills (۳۷ اسکیل مهندسی TS)، ui-ux-pro-max-skill (کاتالوگ طراحی UI/UX)، ai-engineering-hub (۹۳+ نمونه AI)
- خواندن کامل PDF سند SOW (۶ صفحه) — سیستم MEP-PMS با ۶ ماژول، ۴ موتور هوشمند، ERD و ماتریس RBAC
- Init محیط fullstack-dev (Next.js 16 + Prisma + SQLite + shadcn/ui)
- Prisma schema با ۲۹ مدل منطبق بر ERD سند (Tenant/User/Role/Permission + Person/GuaranteeCheck/Team + Project/Phase/Contract/Installment/MaterialItem/Receipt/Balance + Task/Approval/WorkLog/Evidence + PaymentLink/Payment/CommissionTier/Commission/Payout + Escalation/CallLog/Notification/SmsTemplate/Setting/AuditLog)
- Auth دستی (scrypt + HMAC cookie)، RBAC با ۲۸ مجوز / ۶ نقش / تنظیم مجوز از پنل بدون کدنویسی
- ۴ موتور طبق بخش ۴.۷ سند: Tariff (مقطوع/متراژی/پایه+مازاد)، Commission (پلکانی ۲-۵٪، تسویه ۵۰/۵۰)، HardGate (قفل تسویه + کسر خودکار کسری)، Escalation (قسط ۴۸/۹۶h، وظیفه ۲۴h، تراز ۷۲h، چک ۳۰/۱۵ روز)
- Seed دمو: ۶ کاربر (رمز 1234)، ۵ رسته، ۳ پروژه، ۳ قرارداد، اقساط، وظایف معوق، تراز مصالح مرحله ۱
- ~۲۰ API Route برای همه ماژول‌ها

Stage Summary:
- Backend کامل؛ دیتابیس seed شد؛ موتورها پیاده شدند

---
Task ID: 2
Agent: main (Super Z)
Task: فرانت‌اند RTL فارسی، تست E2E با Agent Browser و تحویل

Work Log:
- layout.tsx با dir=rtl، lang=fa، فونت Vazirmatn؛ globals.css با پالت زمردی حرفه‌ای (بدون آبی/ایندیگو طبق اسکیل ui-ux-pro-max)
- معماری SPA تک‌مسیری (/) با Zustand store: ناوبری نقش‌محور مبتنی بر permissions
- ۱۱ کامپوننت اصلی: login، shell (سایدبار تیره + زنگ اعلان + منوی موبایل Sheet)، dashboard (KPI + ۳ نمودار Recharts + رادار گلوگاه + هشدار چک + لاگ پیامک)، action-center (تایید یک‌کلیکی + دیالوگ رد با دلیل)، projects (کارت + جزئیات با تب‌ها + سد سخت + ۴ دیالوگ ایجاد)، people (۳ تب اشخاص/اکیپ/چک)، mytasks (نمای موبایل سرپرست + ثبت کارکرد با شواهد + تراز مصالح)، finance (اقساط/وصولی/تسویه + لینک پرداخت + همگام‌سازی حسابفاری)، secretary (صف ارجاع + ثبت تماس)، commissions (نمای بازاریاب)، reports (P&L تفکیکی)، settings (۶ تب: آستانه/پلکان/پیامک/رسته/RBAC/عمومی)، payment-modal (شبیه‌سازی درگاه)
- تاریخ شمسی: jalali.ts (الگوریتم استاندارد gregorianToJalali/jalaliToGregorian) + اعداد فارسی در format.ts
- باگ‌های رفع‌شده در تست E2E: permissions در پاسخ لاگین، commissions/workLogs در include لیست پروژه‌ها، personId در session (فیلتر وظایف من)، defaultView در /me، ترتیب حذف FK در seed، Card import
- تست موفق: لاگین همه نقش‌ها، داشبورد BI، ثبت کارکرد متراژی (۲.۵M×۴۵=۱۱۲.۵M) → تایید یک‌کلیکی مدیر → worklog APPROVED، سد سخت (HTTP 423 + لیست ۶ قلم ناقص + کسر کسری ۶۴۰K)، لینک پرداخت → شبیه‌سازی شاپرک → قسط PAID خودکار، موتور پیگیری (۲ پیامک + ارجاعات)، کارتابل منشی، P&L (۳ پروژه/۳ رسته/۱ بازاریاب)
- Lint نهایی: ۰ خطا

Stage Summary:
- سیستم کامل و قابل استفاده؛ همه ۶ ماژول SOW + ۴ موتور پیاده و تست شد
- فناوری: Next.js 16 App Router / TypeScript / Prisma+SQLite / shadcn/ui / Recharts / Zustand / Vazirmatn RTL
- حساب‌های دمو: manager/secretary/supervisor/accountant/marketer/team — رمز همه: 1234
