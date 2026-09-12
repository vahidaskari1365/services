// Seed اولیه سیستم بر اساس سند SOW — اجرای یک‌بار با bun scripts/seed.ts
// کاربران دمو، رسته‌ها، پروژه‌ها، قراردادها، اقساط، وظایف، تعرفه‌ها و پلکان پورسانت

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const day = 86400000;
const now = Date.now();
const d = (offsetDays: number) => new Date(now + offsetDays * day);

async function main() {
  console.log("Seeding MEP-PMS ...");

  const tables = [
    "auditLog", "notification", "callLog", "escalation", "smsTemplate", "setting",
    "payout", "commission", "commissionTier", "payment", "paymentLink",
    "workLogEvidence", "workLog", "approval", "task",
    "materialBalance", "materialReceipt", "materialItem", "contractInstallment",
    "contract", "phase", "project", "serviceLine", "teamMember", "team",
    "guaranteeCheck", "user", "person", "role", "permission", "tenant",
  ];
  // شکستن حلقه کلید خارجی installment → payment (قبل از حذف)
  await db.contractInstallment.updateMany({ data: { paymentId: null } });
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)[t].deleteMany({});
  }

  const tenant = await db.tenant.create({ data: { name: "شرکت تأسیسات نمونه (دمو)", slug: "demo" } });

  const permCatalog: [string, string, string][] = [
    ["dashboard.view", "مشاهده داشبورد و شاخص‌ها", "داشبورد"],
    ["reports.pnl", "گزارش سود و زیان", "داشبورد"],
    ["persons.manage", "مدیریت اشخاص", "اشخاص"],
    ["persons.view", "مشاهده اشخاص", "اشخاص"],
    ["teams.manage", "مدیریت اکیپ‌ها و چک ضمانت", "اشخاص"],
    ["teams.view", "مشاهده اکیپ‌ها", "اشخاص"],
    ["projects.manage", "ایجاد و مدیریت پروژه", "پروژه‌ها"],
    ["projects.view", "مشاهده پروژه‌ها", "پروژه‌ها"],
    ["contracts.manage", "ایجاد و مدیریت قرارداد", "پروژه‌ها"],
    ["contracts.view", "مشاهده قراردادها", "پروژه‌ها"],
    ["tasks.viewAll", "مشاهده همه وظایف", "عملیات"],
    ["tasks.own", "مشاهده وظایف خود", "عملیات"],
    ["tasks.manage", "ایجاد و تخصیص وظیفه", "عملیات"],
    ["worklogs.create", "ثبت کارکرد با شواهد", "عملیات"],
    ["worklogs.viewAll", "مشاهده همه کارکردها", "عملیات"],
    ["material.balance", "ثبت تراز مصالح", "عملیات"],
    ["material.view", "مشاهده مصالح و تراز", "عملیات"],
    ["approvals.decide", "تأیید/رد نهایی تاییدیه‌ها", "مرکز عملیات"],
    ["approvals.request", "ثبت درخواست تسویه", "مرکز عملیات"],
    ["finance.manage", "مدیریت مالی", "مالی"],
    ["finance.view", "مشاهده مالی", "مالی"],
    ["payments.link", "صدور لینک پرداخت", "مالی"],
    ["commissions.view", "مشاهده پورسانت‌ها", "مالی"],
    ["accounting.sync", "همگام‌سازی حسابداری", "مالی"],
    ["escalations.view", "کارتابل ارجاعات", "پیگیری"],
    ["escalations.handle", "ثبت نتیجه تماس", "پیگیری"],
    ["settings.manage", "مدیریت تنظیمات", "تنظیمات"],
    ["settings.roles", "مدیریت نقش‌ها و دسترسی", "تنظیمات"],
  ];

  const permissions: Record<string, { id: string }> = {};
  for (const [key, name, module] of permCatalog) {
    permissions[key] = await db.permission.create({ data: { key, name, module } });
  }

  const roleSeeds: [string, string, string, string[]][] = [
    ["MANAGER", "مدیر", "کنترل کامل سیستم؛ تأیید نهایی مالی؛ گزارش سود و زیان", permCatalog.map((p) => p[0])],
    ["SECRETARY", "منشی", "کارتابل ارجاعات، ثبت نتیجه تماس، پیگیری اقساط", ["dashboard.view", "persons.view", "teams.view", "projects.view", "contracts.view", "tasks.viewAll", "escalations.view", "escalations.handle", "finance.view"]],
    ["SUPERVISOR", "سرپرست کارگاه", "نمای موبایل وظایف، ثبت کارکرد و تراز مصالح با شواهد", ["tasks.own", "worklogs.create", "material.balance", "material.view", "projects.view", "persons.view"]],
    ["ACCOUNTANT", "حسابدار", "ماژول مالی، همگام‌سازی حسابفاری، خروجی اسناد", ["dashboard.view", "finance.manage", "finance.view", "payments.link", "commissions.view", "accounting.sync", "reports.pnl", "projects.view", "contracts.view", "persons.view"]],
    ["MARKETER", "بازاریاب", "پروژه‌های خودش و وضعیت پورسانت", ["projects.view", "contracts.view", "commissions.view", "persons.view"]],
    ["TEAM", "اکیپ اجرایی", "مشاهده قرارداد و تسویه خود، ثبت مستندات", ["contracts.view", "projects.view", "finance.view"]],
  ];

  const roles: Record<string, { id: string }> = {};
  for (const [key, name, description, perms] of roleSeeds) {
    roles[key] = await db.role.create({
      data: {
        tenantId: tenant.id, key, name, description, isSystem: true,
        permissions: { connect: perms.map((p) => ({ id: permissions[p].id })) },
      },
    });
  }

  const employer1 = await db.person.create({ data: { tenantId: tenant.id, type: "EMPLOYER", fullName: "آقای رضا محمدی", phone: "09121234567", address: "تهران، سعادت‌آباد" } });
  const employer2 = await db.person.create({ data: { tenantId: tenant.id, type: "EMPLOYER", fullName: "خانواده املاک کیان", phone: "02188776655", address: "تهران، ونک" } });
  const supervisor1 = await db.person.create({ data: { tenantId: tenant.id, type: "SUPERVISOR", fullName: "علی رضایی", phone: "09132345678", nationalId: "0012345678" } });
  const supervisor2 = await db.person.create({ data: { tenantId: tenant.id, type: "SUPERVISOR", fullName: "حسن کریمی", phone: "09193456789" } });
  const marketer1 = await db.person.create({ data: { tenantId: tenant.id, type: "MARKETER", fullName: "مریم صادقی", phone: "09124567890", marketerCode: "MK-101", defaultPercent: 3 } });
  const teamLeader1 = await db.person.create({ data: { tenantId: tenant.id, type: "TEAM_LEADER", fullName: "مهدی قاسمی", phone: "09125678901" } });
  const teamLeader2 = await db.person.create({ data: { tenantId: tenant.id, type: "TEAM_LEADER", fullName: "اکبر نوروزی", phone: "09126789012" } });
  const member1 = await db.person.create({ data: { tenantId: tenant.id, type: "OTHER", fullName: "سعید احمدی (لوله‌کش)", phone: "09301112233" } });
  const member2 = await db.person.create({ data: { tenantId: tenant.id, type: "OTHER", fullName: "جواد فتحی (برق‌کار)", phone: "09302223344" } });

  const team1 = await db.team.create({
    data: {
      tenantId: tenant.id, name: "اکیپ لوله‌کشی قاسمی", leaderId: teamLeader1.id,
      notes: "تخصص: لوله‌کشی آب و گاز",
      members: { create: [{ personId: teamLeader1.id, role: "LEADER" }, { personId: member1.id, role: "MEMBER" }] },
    },
  });
  const team2 = await db.team.create({
    data: {
      tenantId: tenant.id, name: "اکیپ برق نوروزی", leaderId: teamLeader2.id,
      notes: "تخصص: برق و آتش‌نشانی",
      members: { create: [{ personId: teamLeader2.id, role: "LEADER" }, { personId: member2.id, role: "MEMBER" }] },
    },
  });

  // ثبت وصولی‌های اقساط پرداخت‌شده (برای گزارش سود و زیان)
  await db.payment.createMany({
    data: [
      { tenantId: tenant.id, amount: 540000000, method: "TRANSFER", paidAt: d(-49), gatewayRef: "TRF-88121", note: "پیش‌پرداخت برج آرمان" },
      { tenantId: tenant.id, amount: 285000000, method: "GATEWAY", paidAt: d(-25), gatewayRef: "SHAPARAK-A1B2C", note: "پیش‌پرداخت مجتمع کیان" },
    ],
  });

  await db.guaranteeCheck.createMany({
    data: [
      { tenantId: tenant.id, personId: teamLeader1.id, checkNumber: "CHK-770121", amount: 200000000, bankName: "ملت", dueDate: d(45), status: "VALID", notes: "چک ضمانت حسن انجام کار" },
      { tenantId: tenant.id, personId: teamLeader2.id, checkNumber: "CHK-880455", amount: 150000000, bankName: "صادرات", dueDate: d(12), status: "VALID", notes: "نیازمند تمدید" },
    ],
  });

  const lineWater = await db.serviceLine.create({ data: { tenantId: tenant.id, name: "آب و لوله‌کشی", code: "WTR" } });
  const lineElec = await db.serviceLine.create({ data: { tenantId: tenant.id, name: "برق", code: "ELC" } });
  const lineGas = await db.serviceLine.create({ data: { tenantId: tenant.id, name: "گاز", code: "GAS" } });
  await db.serviceLine.create({ data: { tenantId: tenant.id, name: "آتش‌نشانی", code: "FIR" } });
  await db.serviceLine.create({ data: { tenantId: tenant.id, name: "پلی‌اتیلن", code: "PEX" } });

  const project1 = await db.project.create({
    data: {
      tenantId: tenant.id, name: "برج مسکونی آرمان", code: "PRJ-1403-01",
      employerId: employer1.id, supervisorId: supervisor1.id, serviceLineId: lineWater.id,
      address: "تهران، بلوار کشاورز", status: "ACTIVE", startDate: d(-60), endDate: d(90),
      budget: 4500000000,
      phases: {
        create: [
          { title: "لوله‌کشی اصلی آب", order: 1, status: "DONE", startDate: d(-60), endDate: d(-10) },
          { title: "لوله‌کشی فرعی طبقات", order: 2, status: "IN_PROGRESS", startDate: d(-10) },
          { title: "تست و تحویل", order: 3, status: "PENDING" },
        ],
      },
    },
    include: { phases: true },
  });
  const project2 = await db.project.create({
    data: {
      tenantId: tenant.id, name: "مجتمع تجاری کیان", code: "PRJ-1403-02",
      employerId: employer2.id, supervisorId: supervisor2.id, serviceLineId: lineElec.id,
      address: "تهران، ونک", status: "ACTIVE", startDate: d(-30), endDate: d(120),
      budget: 2800000000,
      phases: {
        create: [
          { title: "سیم‌کشی اصلی", order: 1, status: "IN_PROGRESS", startDate: d(-30) },
          { title: "تابلو برق", order: 2, status: "PENDING" },
        ],
      },
    },
    include: { phases: true },
  });
  const project3 = await db.project.create({
    data: {
      tenantId: tenant.id, name: "ویلای لواسان", code: "PRJ-1403-03",
      employerId: employer1.id, supervisorId: supervisor1.id, serviceLineId: lineGas.id,
      address: "لواسان", status: "ACTIVE", startDate: d(-15), endDate: d(60),
      budget: 900000000,
      phases: { create: [{ title: "انشعاب گاز", order: 1, status: "IN_PROGRESS", startDate: d(-15) }] },
    },
    include: { phases: true },
  });

  const contract1 = await db.contract.create({
    data: {
      tenantId: tenant.id, projectId: project1.id, type: "WITH_MATERIALS", signingMode: "MULTI",
      title: "قرارداد لوله‌کشی کامل برج آرمان", amount: 1800000000, marketerId: marketer1.id,
      startDate: d(-55), endDate: d(80), status: "ACTIVE",
      notes: "قرارداد بامصالح؛ سد سخت تراز مصالح فعال است",
      materialItems: {
        create: [
          { tenantId: tenant.id, name: "لوله پنج‌لایه سایز ۲۵", unit: "شاخه", unitPrice: 850000, plannedQty: 120 },
          { tenantId: tenant.id, name: "سه‌راه پنج‌لایه", unit: "عدد", unitPrice: 320000, plannedQty: 200 },
          { tenantId: tenant.id, name: "کلکتور برنجی", unit: "عدد", unitPrice: 1500000, plannedQty: 24 },
        ],
      },
      installments: {
        create: [
          { tenantId: tenant.id, title: "پیش‌پرداخت (۳۰٪)", amount: 540000000, dueDate: d(-50), status: "PAID", paidAt: d(-49) },
          { tenantId: tenant.id, title: "قسط دوم پس از لوله‌کشی اصلی", amount: 630000000, dueDate: d(-2) },
          { tenantId: tenant.id, title: "قسط سوم پس از فرعی طبقات", amount: 630000000, dueDate: d(30) },
        ],
      },
    },
    include: { materialItems: true },
  });

  const contract2 = await db.contract.create({
    data: {
      tenantId: tenant.id, projectId: project2.id, type: "WAGE", signingMode: "SINGLE",
      title: "قرارداد دستمزدی سیم‌کشی مجتمع کیان", amount: 950000000, marketerId: marketer1.id,
      startDate: d(-28), endDate: d(110), status: "ACTIVE",
      installments: {
        create: [
          { tenantId: tenant.id, title: "پیش‌پرداخت", amount: 285000000, dueDate: d(-25), status: "PAID", paidAt: d(-25) },
          { tenantId: tenant.id, title: "قسط دوم", amount: 332500000, dueDate: d(-6) },
          { tenantId: tenant.id, title: "تسویه نهایی", amount: 332500000, dueDate: d(60) },
        ],
      },
    },
  });

  const contract3 = await db.contract.create({
    data: {
      tenantId: tenant.id, projectId: project3.id, type: "WAGE", signingMode: "SINGLE",
      title: "قرارداد انشعاب گاز ویلا", amount: 320000000,
      startDate: d(-12), endDate: d(45), status: "ACTIVE",
      installments: { create: [{ tenantId: tenant.id, title: "پرداخت کامل", amount: 320000000, dueDate: d(20) }] },
    },
  });

  await db.materialReceipt.createMany({
    data: [
      { tenantId: tenant.id, contractId: contract1.id, materialItemId: contract1.materialItems[0].id, qty: 90, receivedAt: d(-40) },
      { tenantId: tenant.id, contractId: contract1.id, materialItemId: contract1.materialItems[1].id, qty: 120, receivedAt: d(-38) },
      { tenantId: tenant.id, contractId: contract1.id, materialItemId: contract1.materialItems[2].id, qty: 12, receivedAt: d(-35) },
    ],
  });

  const wl1 = await db.workLog.create({
    data: {
      tenantId: tenant.id, projectId: project1.id, contractId: contract1.id, phaseId: project1.phases[0].id,
      teamId: team1.id, personId: supervisor1.id, date: d(-12), description: "تکمیل لوله‌کشی اصلی آب و تست فشار",
      status: "APPROVED", tariffType: "METERED", rate: 2500000, quantity: 96, computedAmount: 240000000,
      approvedById: "system", approvedAt: d(-11),
    },
  });
  await db.workLog.create({
    data: {
      tenantId: tenant.id, projectId: project1.id, contractId: contract1.id, phaseId: project1.phases[1].id,
      teamId: team1.id, personId: supervisor1.id, date: d(-3), description: "پیشرفت ۶۰ درصدی لوله‌کشی فرعی طبقات",
      status: "PENDING", tariffType: "METERED", rate: 2500000, quantity: 60,
    },
  });
  await db.workLog.create({
    data: {
      tenantId: tenant.id, projectId: project2.id, contractId: contract2.id, phaseId: project2.phases[0].id,
      teamId: team2.id, personId: supervisor2.id, date: d(-5), description: "سیم‌کشی طبقات ۱ تا ۳ + تنخواه خرید مستربری",
      status: "APPROVED", tariffType: "BASE_PLUS_EXTRA", baseAmount: 80000000, extraUnits: 2, extraRate: 5000000,
      computedAmount: 90000000, approvedById: "system", approvedAt: d(-4),
    },
  });

  await db.workLogEvidence.createMany({
    data: [
      { workLogId: wl1.id, kind: "PHOTO", title: "عکس مسیر لوله‌کشی طبقه همکف", value: "" },
      { workLogId: wl1.id, kind: "LOCATION", title: "لوکیشن کارگاه", value: "35.7448,51.3753" },
      { workLogId: wl1.id, kind: "INVOICE", title: "فاکتور تست فشار", value: "" },
    ],
  });

  await db.materialBalance.createMany({
    data: [
      { tenantId: tenant.id, contractId: contract1.id, phaseId: project1.phases[0].id, materialItemId: contract1.materialItems[0].id, consumedQty: 88, surplusQty: 2, shortageQty: 0, notes: "۲ شاخه مازاد به انبار برگشت" },
      { tenantId: tenant.id, contractId: contract1.id, phaseId: project1.phases[0].id, materialItemId: contract1.materialItems[1].id, consumedQty: 61, surplusQty: 0, shortageQty: 2, notes: "۲ عدد سه‌راه شکسته؛ کسر از دستمزد" },
      { tenantId: tenant.id, contractId: contract1.id, phaseId: project1.phases[0].id, materialItemId: contract1.materialItems[2].id, consumedQty: 8, surplusQty: 0, shortageQty: 0 },
    ],
  });

  await db.task.createMany({
    data: [
      { tenantId: tenant.id, projectId: project1.id, contractId: contract1.id, assigneePersonId: supervisor1.id, title: "ثبت تراز مصالح مرحله لوله‌کشی اصلی", description: "گزارش مصرف، مازاد و کسری سه قلم مصالح", dueDate: d(-2), status: "IN_PROGRESS", priority: "HIGH" },
      { tenantId: tenant.id, projectId: project1.id, contractId: contract1.id, assigneePersonId: supervisor1.id, title: "بازدید از پیشرفت لوله‌کشی طبقات ۴ تا ۷", description: "گزارش عکس‌دار", dueDate: d(1), status: "TODO", priority: "NORMAL" },
      { tenantId: tenant.id, projectId: project2.id, contractId: contract2.id, assigneePersonId: supervisor2.id, title: "رفع مغایرت تابلو برق طبقه ۲", description: "هماهنگی با پیمانکار تابلو", dueDate: d(-3), status: "BLOCKED", priority: "CRITICAL" },
      { tenantId: tenant.id, projectId: project3.id, contractId: contract3.id, assigneePersonId: supervisor1.id, title: "هماهنگی بازدید شرکت گاز", description: "تعیین وقت با اداره گاز لواسان", dueDate: d(2), status: "TODO", priority: "NORMAL" },
    ],
  });

  await db.commissionTier.createMany({
    data: [
      { tenantId: tenant.id, label: "پلکان ۱ — تا ۵۰۰ میلیون", minAmount: 0, maxAmount: 500000000, percent: 2, order: 1 },
      { tenantId: tenant.id, label: "پلکان ۲ — ۵۰۰ میلیون تا ۱ میلیارد", minAmount: 500000000, maxAmount: 1000000000, percent: 3, order: 2 },
      { tenantId: tenant.id, label: "پلکان ۳ — بالای ۱ میلیارد", minAmount: 1000000000, maxAmount: null, percent: 5, order: 3 },
    ],
  });

  await db.commission.create({
    data: {
      tenantId: tenant.id, contractId: contract1.id, marketerId: marketer1.id,
      contractAmount: 1800000000, percent: 5, totalAmount: 90000000,
      signPart: 45000000, signPaid: true, collectionTarget: 45000000, status: "PARTIAL",
    },
  });
  await db.commission.create({
    data: {
      tenantId: tenant.id, contractId: contract2.id, marketerId: marketer1.id,
      contractAmount: 950000000, percent: 3, totalAmount: 28500000,
      signPart: 14250000, signPaid: true, collectionTarget: 14250000, status: "PARTIAL",
    },
  });

  const settings: [string, string, string, string][] = [
    ["INSTALLMENT_SMS2_HOURS", "48", "ESCALATION", "فاصله یادآور دوم قسط (ساعت)"],
    ["INSTALLMENT_ESCALATE_HOURS", "96", "ESCALATION", "مهلت ارجاع قسط به منشی (ساعت)"],
    ["TASK_DUE_SOON_HOURS", "24", "ESCALATION", "هشدار موعد وظیفه (ساعت قبل)"],
    ["TASK_CRITICAL_HOURS", "24", "ESCALATION", "آستانه تاخیر بحرانی وظیفه (ساعت)"],
    ["BALANCE_ALARM_HOURS", "72", "ESCALATION", "آلارم عدم ثبت تراز پس از اتمام کار (ساعت)"],
    ["CHECK_WARN_30_DAYS", "30", "ESCALATION", "هشدار اول چک ضمانت (روز)"],
    ["CHECK_WARN_15_DAYS", "15", "ESCALATION", "هشدار دوم چک ضمانت (روز)"],
    ["COMMISSION_SIGN_SHARE", "50", "COMMISSION", "سهم پورسانت هنگام عقد قرارداد (٪)"],
    ["COMMISSION_FIXED_BONUS", "0", "COMMISSION", "پاداش ثابت پورسانت (ریال)"],
    ["COMPANY_NAME", "شرکت تأسیسات نمونه", "GENERAL", "نام شرکت"],
    ["GATEWAY_NAME", "درگاه شاپرک (شبیه‌سازی)", "FINANCE", "درگاه پرداخت"],
    ["ACCOUNTING_SOFTWARE", "حسابفاری (Hesabfa)", "FINANCE", "نرم‌افزار حسابداری"],
  ];
  for (const [key, value, group, label] of settings) {
    await db.setting.create({ data: { tenantId: tenant.id, key, value, group, label } });
  }

  await db.smsTemplate.createMany({
    data: [
      { tenantId: tenant.id, key: "INSTALLMENT_REMINDER_1", label: "یادآوری اول قسط کارفرما", body: "{name} گرامی، قسط {amount} ریالی پروژه {project} سررسید شده است. جهت پرداخت آنلاین: {link}\nشرکت تأسیسات نمونه" },
      { tenantId: tenant.id, key: "INSTALLMENT_REMINDER_2", label: "یادآوری دوم قسط", body: "{name} گرامی، یادآوری مجدد: قسط {amount} ریالی پروژه {project} همچنان پرداخت نشده است. {link}" },
      { tenantId: tenant.id, key: "TASK_DUE", label: "یادآوری موعد وظیفه سرپرست", body: "{name}، وظیفه «{title}» در پروژه {project} تا تاریخ {date} سررسید می‌شود. لطفاً اقدام فرمایید." },
      { tenantId: tenant.id, key: "BALANCE_ALERT", label: "هشدار عدم ثبت تراز مصالح", body: "{name}، تراز مصالح قرارداد «{contract}» در پروژه {project} ثبت نشده و تسویه اکیپ مسدود است." },
      { tenantId: tenant.id, key: "CHECK_EXPIRY", label: "هشدار سررسید چک ضمانت اکیپ", body: "چک ضمانت {name} در تاریخ {date} سررسید می‌شود. لطفاً نسبت به تمدید اقدام شود." },
    ],
  });

  const users: [string, string, string, string, string?][] = [
    ["manager", "مدیر سیستم", "1234", "MANAGER"],
    ["secretary", "منشی شرکت", "1234", "SECRETARY"],
    ["supervisor", "علی رضایی (سرپرست)", "1234", "SUPERVISOR", supervisor1.id],
    ["accountant", "حسابدار شرکت", "1234", "ACCOUNTANT"],
    ["marketer", "مریم صادقی (بازاریاب)", "1234", "MARKETER", marketer1.id],
    ["team", "مهدی قاسمی (اکیپ)", "1234", "TEAM", teamLeader1.id],
  ];
  for (const [username, fullName, password, roleKey, personId] of users) {
    await db.user.create({
      data: {
        tenantId: tenant.id, username, fullName, passwordHash: hashPassword(password),
        roleId: roles[roleKey].id, personId: personId || null,
      },
    });
  }

  console.log("Seed complete! Users: manager/secretary/supervisor/accountant/marketer/team — pass: 1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
