// ── موتور پیگیری هوشمند و ارجاع خودکار — Escalation Engine (بخش ۴.۷.۴ سند SOW) ──
// جاب‌های پس‌زمینه (Cron) سیرسید‌ها را زمان‌بندی‌شده رصد می‌کنند:
//  ۱) اقساط کارفرما: پیامک محترمانه با لینک پرداخت در سررسید؛ یادآور دوم پس از ۴۸ ساعت؛
//     در صورت عدم پرداخت تا ۹۶ ساعت، ایجاد تسک تماس در کارتابل منشی با شماره‌گیری سریع
//  ۲) وظایف سرپرست: اعلان درون‌برنامه‌ای و پیامک ۲۴ ساعت قبل از موعد؛ تأخیر بیش از ۲۴ ساعت
//     → برچسب «تاخیر بحرانی» و وظیفه گلوگاهی + ارجاع به صف پیگیری منشی
//  ۳) تراز مصالح: عدم ثبت تراز تا ۷۲ ساعت پس از اتمام کار ← آلارم مسدودی تسویه در داشبورد مدیر
//     و تسک پیگیری برای منشی
//  ۴) چک ضمانت اکیپ‌ها: هشدار تمدید ۳۰ و ۱۵ روز قبل؛ در صورت عدم تمدید، قفل ارجاع پروژه جدید
// متن و زمان‌بندی همه پیامک‌ها/اعلان‌ها از پنل تنظیمات خوانده می‌شود (نه کد هارد)

import { db } from "@/lib/db";
import { renderSmsTemplate } from "@/lib/sms";

const HOUR = 3600_000;

export interface EngineRunResult {
  ranAt: string;
  sms1: number;
  sms2: number;
  escalatedInstallments: number;
  dueSoonTasks: number;
  criticalTasks: number;
  balanceAlarms: number;
  checkWarnings: number;
  lockedTeams: number;
}

async function getSettingNum(tenantId: string, key: string, fallback: number): Promise<number> {
  const s = await db.setting.findUnique({ where: { key } });
  const v = s ? parseFloat(s.value) : NaN;
  return isNaN(v) ? fallback : v;
}

async function getTemplate(tenantId: string, key: string): Promise<string | null> {
  const t = await db.smsTemplate.findUnique({ where: { key } });
  return t && t.enabled ? t.body : null;
}

async function sendNotification(
  tenantId: string,
  opts: { channel: "IN_APP" | "SMS"; title: string; body: string; refType?: string; refId?: string; userId?: string }
) {
  await db.notification.create({
    data: {
      tenantId,
      userId: opts.userId,
      channel: opts.channel,
      title: opts.title,
      body: opts.body,
      refType: opts.refType || "",
      refId: opts.refId,
      status: opts.channel === "SMS" ? "SIMULATED" : "SENT",
    },
  });
}

export async function runEscalationEngine(tenantId: string): Promise<EngineRunResult> {
  const now = new Date();
  const result: EngineRunResult = {
    ranAt: now.toISOString(), sms1: 0, sms2: 0, escalatedInstallments: 0,
    dueSoonTasks: 0, criticalTasks: 0, balanceAlarms: 0, checkWarnings: 0, lockedTeams: 0,
  };

  const hoursSms2 = await getSettingNum(tenantId, "INSTALLMENT_SMS2_HOURS", 48);
  const hoursEscalate = await getSettingNum(tenantId, "INSTALLMENT_ESCALATE_HOURS", 96);
  const taskDueSoonHours = await getSettingNum(tenantId, "TASK_DUE_SOON_HOURS", 24);
  const taskCriticalHours = await getSettingNum(tenantId, "TASK_CRITICAL_HOURS", 24);
  const balanceHours = await getSettingNum(tenantId, "BALANCE_ALARM_HOURS", 72);

  // ─── ۱) اقساط کارفرما ───
  const pendingInstallments = await db.contractInstallment.findMany({
    where: { tenantId, status: "PENDING", dueDate: { lte: now } },
    include: { contract: { include: { project: { include: { employer: true } } } }, paymentLinks: true },
  });

  for (const inst of pendingInstallments) {
    const hoursOverdue = (now.getTime() - inst.dueDate.getTime()) / HOUR;
    const employer = inst.contract.project.employer;
    const link = inst.paymentLinks.find((l) => l.status === "ACTIVE");

    if (inst.escalationStage === 0) {
      const body = await renderSmsTemplate("INSTALLMENT_REMINDER_1", tenantId, {
        name: employer?.fullName || "کارفرما گرامی",
        amount: inst.amount.toLocaleString("fa-IR"),
        project: inst.contract.project.name,
        link: link ? `/api/pay/${link.token}` : "-",
        date: inst.dueDate.toLocaleDateString("fa-IR"),
      });
      if (body) await sendNotification(tenantId, { channel: "SMS", title: "یادآوری قسط", body, refType: "installment", refId: inst.id });
      await db.contractInstallment.update({ where: { id: inst.id }, data: { escalationStage: 1, sms1SentAt: now } });
      result.sms1++;
    } else if (inst.escalationStage === 1 && hoursOverdue >= hoursSms2) {
      const body = await renderSmsTemplate("INSTALLMENT_REMINDER_2", tenantId, {
        name: employer?.fullName || "کارفرما گرامی",
        amount: inst.amount.toLocaleString("fa-IR"),
        project: inst.contract.project.name,
        link: link ? `/api/pay/${link.token}` : "-",
        date: inst.dueDate.toLocaleDateString("fa-IR"),
      });
      if (body) await sendNotification(tenantId, { channel: "SMS", title: "یادآوری دوم قسط", body, refType: "installment", refId: inst.id });
      await db.contractInstallment.update({ where: { id: inst.id }, data: { escalationStage: 2, sms2SentAt: now } });
      result.sms2++;
    } else if (inst.escalationStage === 2 && hoursOverdue >= hoursEscalate) {
      const exists = await db.escalation.findFirst({
        where: { tenantId, kind: "INSTALLMENT_UNPAID", refId: inst.id, status: "OPEN" },
      });
      if (!exists) {
        await db.escalation.create({
          data: {
            tenantId,
            kind: "INSTALLMENT_UNPAID",
            severity: "CRITICAL",
            title: `تماس برای قسط معوق: ${inst.title} — ${inst.contract.project.name}`,
            description: `قسط ${inst.amount.toLocaleString("fa-IR")} ریالی با ${Math.floor(hoursOverdue)} ساعت تأخیر پرداخت نشده. با ${employer?.fullName || "کارفرما"} (${employer?.phone || "-"}) تماس بگیرید.`,
            refType: "installment",
            refId: inst.id,
            assignedRole: "SECRETARY",
          },
        });
      }
      await db.contractInstallment.update({ where: { id: inst.id }, data: { escalationStage: 3, escalatedAt: now } });
      result.escalatedInstallments++;
    }
  }

  // ─── ۲) وظایف سرپرست ───
  const openTasks = await db.task.findMany({
    where: { tenantId, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
    include: { project: true, assigneePerson: true },
  });

  for (const task of openTasks) {
    const hoursToDue = (task.dueDate.getTime() - now.getTime()) / HOUR;
    const hoursOverdue = -hoursToDue;

    // ۲۴ ساعت قبل از موعد: اعلان درون‌برنامه‌ای + پیامک
    if (hoursToDue > 0 && hoursToDue <= taskDueSoonHours && !task.dueSoonNotifiedAt) {
      const body = await renderSmsTemplate("TASK_DUE", tenantId, {
        name: task.assigneePerson?.fullName || "سرپرست گرامی",
        project: task.project.name,
        title: task.title,
        date: task.dueDate.toLocaleDateString("fa-IR"),
        link: "-",
      });
      await sendNotification(tenantId, { channel: "IN_APP", title: `وظیفه در آستانه موعد: ${task.title}`, body: `موعد: ${task.dueDate.toLocaleDateString("fa-IR")}`, refType: "task", refId: task.id });
      if (body) await sendNotification(tenantId, { channel: "SMS", title: "یادآوری وظیفه", body, refType: "task", refId: task.id });
      await db.task.update({ where: { id: task.id }, data: { dueSoonNotifiedAt: now } });
      result.dueSoonTasks++;
    }

    // تأخیر بیش از حد مجاز: برچسب تاخیر بحرانی + گلوگاه + ارجاع به منشی
    if (hoursOverdue > taskCriticalHours && !task.isBottleneck) {
      await db.task.update({ where: { id: task.id }, data: { isBottleneck: true, priority: "CRITICAL" } });
      const exists = await db.escalation.findFirst({
        where: { tenantId, kind: "TASK_OVERDUE", refId: task.id, status: "OPEN" },
      });
      if (!exists) {
        await db.escalation.create({
          data: {
            tenantId,
            kind: "TASK_OVERDUE",
            severity: "CRITICAL",
            title: `تاخیر بحرانی: ${task.title} — ${task.project.name}`,
            description: `وظیفه ${Math.floor(hoursOverdue)} ساعت عقب افتاده است. مسئول: ${task.assigneePerson?.fullName || "-"}`,
            refType: "task",
            refId: task.id,
            assignedRole: "SECRETARY",
          },
        });
      }
      await sendNotification(tenantId, { channel: "IN_APP", title: `گلوگاه بحرانی: ${task.title}`, body: `وظیفه با تأخیر ${Math.floor(hoursOverdue)} ساعته به صف پیگیری منشی ارجاع شد`, refType: "task", refId: task.id });
      result.criticalTasks++;
    }
  }

  // ─── ۳) تراز مصالح: آلارم مسدودی تسویه ───
  const materialContracts = await db.contract.findMany({
    where: { tenantId, type: "WITH_MATERIALS", status: "ACTIVE" },
    include: { project: { include: { phases: true } }, balances: true, materialItems: true, workLogs: { where: { status: "APPROVED" }, orderBy: { date: "desc" }, take: 1 } },
  });

  for (const contract of materialContracts) {
    const lastWork = contract.workLogs[0];
    if (!lastWork) continue;
    const hoursSinceWork = (now.getTime() - lastWork.date.getTime()) / HOUR;
    if (hoursSinceWork < balanceHours) continue;

    const balanceItemIds = new Set(contract.balances.map((b) => `${b.materialItemId}__${b.phaseId}`));
    const missing = contract.materialItems.some((item) =>
      contract.project.phases.some((p) => !balanceItemIds.has(`${item.id}__${p.id}`))
    );
    if (!missing) continue;

    const exists = await db.escalation.findFirst({
      where: { tenantId, kind: "BALANCE_MISSING", refId: contract.id, status: "OPEN" },
    });
    if (!exists) {
      await db.escalation.create({
        data: {
          tenantId,
          kind: "BALANCE_MISSING",
          severity: "HIGH",
          title: `آلارم مسدودی تسویه: ${contract.title} — ${contract.project.name}`,
          description: `${Math.floor(hoursSinceWork)} ساعت از اتمام کار گذشته و تراز مصالح ثبت نشده است. تسویه اکیپ تا ثبت تراز قفل می‌ماند (سد سخت).`,
          refType: "contract",
          refId: contract.id,
          assignedRole: "MANAGER",
        },
      });
      const body = await renderSmsTemplate("BALANCE_ALERT", tenantId, {
        name: "مدیر محترم",
        project: contract.project.name,
        contract: contract.title,
        date: now.toLocaleDateString("fa-IR"),
        link: "-",
      });
      await sendNotification(tenantId, { channel: "IN_APP", title: `تراز مصالح ثبت نشده: ${contract.title}`, body: "دکمه تسویه اکیپ قفل است؛ پیگیری در کارتابل منشی هم ثبت شد", refType: "contract", refId: contract.id });
      if (body) await sendNotification(tenantId, { channel: "SMS", title: "هشدار تراز مصالح", body, refType: "contract", refId: contract.id });
      result.balanceAlarms++;
    }
  }

  // ─── ۴) چک ضمانت اکیپ‌ها ───
  const checks = await db.guaranteeCheck.findMany({
    where: { tenantId, status: { in: ["VALID", "EXPIRING_SOON"] } },
    include: { person: true },
  });
  const days30 = await getSettingNum(tenantId, "CHECK_WARN_30_DAYS", 30);
  const days15 = await getSettingNum(tenantId, "CHECK_WARN_15_DAYS", 15);

  for (const check of checks) {
    const daysLeft = Math.ceil((check.dueDate.getTime() - now.getTime()) / 86400000);

    if (daysLeft <= days30 && daysLeft > days15 && !check.warn30NotifiedAt) {
      await sendNotification(tenantId, { channel: "IN_APP", title: `هشدار تمدید چک ضمانت (۳۰ روز): ${check.person.fullName}`, body: `چک ${check.checkNumber} در ${daysLeft} روز سررسید می‌شود`, refType: "check", refId: check.id });
      await db.guaranteeCheck.update({ where: { id: check.id }, data: { warn30NotifiedAt: now, status: "EXPIRING_SOON" } });
      result.checkWarnings++;
    }
    if (daysLeft <= days15 && daysLeft > 0 && !check.warn15NotifiedAt) {
      await sendNotification(tenantId, { channel: "IN_APP", title: `هشدار تمدید چک ضمانت (۱۵ روز): ${check.person.fullName}`, body: `چک ${check.checkNumber} فقط ${daysLeft} روز مانده؛ مدیر و منشی مطلع شدند`, refType: "check", refId: check.id });
      await db.guaranteeCheck.update({ where: { id: check.id }, data: { warn15NotifiedAt: now } });
      result.checkWarnings++;
    }
    if (daysLeft <= 0 && !check.lockedNotifiedAt) {
      await db.guaranteeCheck.update({ where: { id: check.id }, data: { status: "EXPIRED", lockedNotifiedAt: now } });
      // قفل ارجاع پروژه جدید به اکیپ مربوط
      const team = await db.team.findFirst({ where: { tenantId, leaderId: check.personId } });
      if (team && !team.isLocked) {
        await db.team.update({ where: { id: team.id }, data: { isLocked: true, lockReason: `چک ضمانت ${check.checkNumber} منقضی شده است` } });
        result.lockedTeams++;
      }
      await db.escalation.create({
        data: {
          tenantId, kind: "CHECK_EXPIRED", severity: "HIGH",
          title: `چک ضمانت منقضی: ${check.person.fullName}`,
          description: `چک ${check.checkNumber} سررسید شده و تمدید نشده. ارجاع پروژه جدید به اکیپ قفل شد.`,
          refType: "check", refId: check.id, assignedRole: "MANAGER",
        },
      });
    }
  }

  return result;
}
