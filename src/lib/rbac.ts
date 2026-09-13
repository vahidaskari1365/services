// RBAC — ماتریس نقش‌ها و دسترسی‌ها بر اساس بخش ۵.۲ سند SOW
// نقش‌ها: مدیر، منشی، سرپرست کارگاه، حسابدار، بازاریاب، اکیپ اجرایی

export const PERMISSION_CATALOG: { key: string; name: string; module: string }[] = [
  // داشبورد و BI
  { key: "dashboard.view", name: "مشاهده داشبورد و شاخص‌ها", module: "داشبورد" },
  { key: "reports.pnl", name: "گزارش سود و زیان", module: "داشبورد" },
  // اشخاص و CRM
  { key: "persons.manage", name: "مدیریت اشخاص (کارفرما، بازاریاب، ناظر)", module: "اشخاص" },
  { key: "persons.view", name: "مشاهده اشخاص", module: "اشخاص" },
  { key: "teams.manage", name: "مدیریت اکیپ‌ها و چک ضمانت", module: "اشخاص" },
  { key: "teams.view", name: "مشاهده اکیپ‌ها", module: "اشخاص" },
  // پروژه و قرارداد
  { key: "projects.manage", name: "ایجاد و مدیریت پروژه", module: "پروژه‌ها" },
  { key: "projects.view", name: "مشاهده پروژه‌ها", module: "پروژه‌ها" },
  { key: "contracts.manage", name: "ایجاد و مدیریت قرارداد", module: "پروژه‌ها" },
  { key: "contracts.view", name: "مشاهده قراردادها", module: "پروژه‌ها" },
  // عملیات میدانی
  { key: "tasks.viewAll", name: "مشاهده همه وظایف", module: "عملیات" },
  { key: "tasks.own", name: "مشاهده وظایف خود", module: "عملیات" },
  { key: "tasks.manage", name: "ایجاد و تخصیص وظیفه", module: "عملیات" },
  { key: "worklogs.create", name: "ثبت کارکرد با شواهد", module: "عملیات" },
  { key: "worklogs.viewAll", name: "مشاهده همه کارکردها", module: "عملیات" },
  { key: "material.balance", name: "ثبت تراز مصالح", module: "عملیات" },
  { key: "material.view", name: "مشاهده مصالح و تراز", module: "عملیات" },
  // تأییدیه‌ها
  { key: "approvals.decide", name: "تأیید/رد نهایی تاییدیه‌ها", module: "مرکز عملیات" },
  { key: "approvals.request", name: "ثبت درخواست تسویه", module: "مرکز عملیات" },
  // مالی
  { key: "finance.manage", name: "مدیریت مالی (پرداخت، تسویه)", module: "مالی" },
  { key: "finance.view", name: "مشاهده مالی", module: "مالی" },
  { key: "payments.link", name: "صدور لینک پرداخت", module: "مالی" },
  { key: "commissions.view", name: "مشاهده پورسانت‌ها", module: "مالی" },
  { key: "accounting.sync", name: "همگام‌سازی حسابفاری / خروجی اسناد", module: "مالی" },
  // پیگیری
  { key: "escalations.view", name: "کارتابل ارجاعات و پیگیری", module: "پیگیری" },
  { key: "escalations.handle", name: "ثبت نتیجه تماس و پیگیری", module: "پیگیری" },
  // تنظیمات
  { key: "settings.manage", name: "مدیریت تنظیمات، تعرفه و فرمول‌ها", module: "تنظیمات" },
  { key: "settings.roles", name: "مدیریت نقش‌ها و دسترسی‌ها", module: "تنظیمات" },
  // مدیریت کاربران
  { key: "users.manage", name: "مدیریت کاربران (ایجاد، نقش، فعال/غیرفعال)", module: "کاربران" },
  // گزارش‌ساز و خروجی
  { key: "reports.build", name: "گزارش‌ساز و خروجی اکسل/CSV/چاپ", module: "گزارش‌ها" },
  // آرشیو اسناد
  { key: "documents.view", name: "مشاهده و دریافت آرشیو اسناد", module: "اسناد" },
  { key: "documents.manage", name: "بارگذاری و حذف اسناد", module: "اسناد" },
];

export const DEFAULT_ROLE_MATRIX: Record<string, string[]> = {
  MANAGER: PERMISSION_CATALOG.map((p) => p.key),
  SECRETARY: [
    "dashboard.view",
    "persons.view",
    "teams.view",
    "projects.view",
    "contracts.view",
    "tasks.viewAll",
    "escalations.view",
    "escalations.handle",
    "finance.view",
    "reports.build",
    "documents.view",
    "documents.manage",
  ],
  SUPERVISOR: ["tasks.own", "worklogs.create", "material.balance", "material.view", "projects.view", "persons.view", "documents.view"],
  ACCOUNTANT: [
    "dashboard.view",
    "finance.manage",
    "finance.view",
    "payments.link",
    "commissions.view",
    "accounting.sync",
    "reports.pnl",
    "reports.build",
    "documents.view",
    "documents.manage",
    "projects.view",
    "contracts.view",
    "persons.view",
  ],
  MARKETER: ["projects.view", "contracts.view", "commissions.view", "persons.view"],
  TEAM: ["contracts.view", "projects.view", "finance.view"],
};

export const ROLE_SEEDS: { key: string; name: string; description: string }[] = [
  { key: "MANAGER", name: "مدیر", description: "کنترل کامل سیستم؛ تأیید نهایی مالی؛ گزارش سود و زیان" },
  { key: "SECRETARY", name: "منشی", description: "کارتابل ارجاعات، ثبت نتیجه تماس، پیگیری اقساط" },
  { key: "SUPERVISOR", name: "سرپرست کارگاه", description: "نمای موبایل وظایف، ثبت کارکرد و تراز مصالح با شواهد" },
  { key: "ACCOUNTANT", name: "حسابدار", description: "ماژول مالی، همگام‌سازی حسابفاری، خروجی اسناد" },
  { key: "MARKETER", name: "بازاریاب", description: "پروژه‌های خودش و وضعیت پورسانت" },
  { key: "TEAM", name: "اکیپ اجرایی", description: "مشاهده قرارداد و تسویه خود، ثبت مستندات" },
];

export const DEFAULT_VIEW_BY_ROLE: Record<string, string> = {
  MANAGER: "dashboard",
  SECRETARY: "secretary",
  SUPERVISOR: "mytasks",
  ACCOUNTANT: "finance",
  MARKETER: "commissions",
  TEAM: "contracts",
};
