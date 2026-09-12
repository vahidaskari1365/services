import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";
import { runEscalationEngine } from "@/lib/engines/escalation";

// داشبورد و هوش تجاری (ماژول ۱) + اجرای خودکار (throttle) موتور پیگیری
export async function GET() {
  return withAuth(async (session) => {
    const tenantId = session.tenantId;

    // اجرای موتور پیگیری حداکثر هر ۵ دقیقه
    const lastRun = await db.setting.findUnique({ where: { key: "ENGINE_LAST_RUN" } });
    const shouldRun = !lastRun || Date.now() - new Date(lastRun.value).getTime() > 5 * 60 * 1000;
    if (shouldRun) {
      try {
        await runEscalationEngine(tenantId);
        await db.setting.upsert({
          where: { key: "ENGINE_LAST_RUN" },
          create: { tenantId, key: "ENGINE_LAST_RUN", value: new Date().toISOString(), group: "SYSTEM", label: "آخرین اجرای موتور" },
          update: { value: new Date().toISOString() },
        });
      } catch (e) {
        console.error("engine auto-run failed", e);
      }
    }

    const [projects, pendingApprovals, bottleneckTasks, tasks, installments, payments, checks, escalations, notifications, worklogs, contracts, commissions] =
      await Promise.all([
        db.project.findMany({ where: { tenantId }, include: { serviceLine: true, employer: true, supervisor: true, contracts: true, tasks: true, phases: true } }),
        db.approval.findMany({ where: { tenantId, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
        db.task.findMany({ where: { tenantId, isBottleneck: true, status: { not: "DONE" } }, include: { project: true, assigneePerson: true }, orderBy: { dueDate: "asc" } }),
        db.task.findMany({ where: { tenantId } }),
        db.contractInstallment.findMany({ where: { tenantId }, include: { contract: { include: { project: true } } }, orderBy: { dueDate: "asc" } }),
        db.payment.findMany({ where: { tenantId, status: "SUCCESS" }, orderBy: { paidAt: "asc" } }),
        db.guaranteeCheck.findMany({ where: { tenantId, status: { in: ["VALID", "EXPIRING_SOON", "EXPIRED"] } }, include: { person: true } }),
        db.escalation.findMany({ where: { tenantId, status: "OPEN" }, orderBy: { createdAt: "desc" } }),
        db.notification.findMany({ where: { tenantId, channel: "IN_APP", status: "SENT" }, orderBy: { sentAt: "desc" }, take: 30 }),
        db.workLog.findMany({ where: { tenantId, status: "APPROVED" } }),
        db.contract.findMany({ where: { tenantId }, include: { project: true } }),
        db.commission.findMany({ where: { tenantId } }),
      ]);

    const now = Date.now();
    const overdueInstallments = installments.filter(
      (i) => i.status === "PENDING" && i.dueDate.getTime() < now
    );
    const totalContractAmount = contracts.reduce((s, c) => s + c.amount, 0);
    const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
    const totalWages = worklogs.reduce((s, w) => s + w.computedAmount, 0);
    const totalCommissions = commissions.reduce((s, c) => s + c.signPaid * 0 + c.signPart + c.collectionPaid, 0);
    const profit = totalCollected - totalWages - totalCommissions;

    // نمودار وصول مطالبات ۶ ماه اخیر (ماه‌های شمسی ساده بر اساس ماه میلادی)
    const collectionSeries: { month: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(1);
      dt.setMonth(dt.getMonth() - i);
      const start = dt.getTime();
      const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 1).getTime();
      const amount = payments
        .filter((p) => p.paidAt.getTime() >= start && p.paidAt.getTime() < end)
        .reduce((s, p) => s + p.amount, 0);
      collectionSeries.push({ month: dt.toLocaleDateString("fa-IR", { month: "long" }), amount });
    }

    const checkAlerts = checks.filter((c) => {
      const daysLeft = Math.ceil((c.dueDate.getTime() - now) / 86400000);
      return daysLeft <= 30;
    });

    return NextResponse.json({
      kpis: {
        activeProjects: projects.filter((p) => p.status === "ACTIVE").length,
        totalProjects: projects.length,
        pendingApprovals: pendingApprovals.length,
        bottlenecks: bottleneckTasks.length,
        overdueInstallments: overdueInstallments.length,
        overdueAmount: overdueInstallments.reduce((s, i) => s + i.amount, 0),
        openEscalations: escalations.length,
        totalContractAmount,
        totalCollected,
        totalWages,
        totalCommissions,
        profit,
        collectionRate: totalContractAmount > 0 ? Math.round((totalCollected / totalContractAmount) * 100) : 0,
      },
      projects: projects.map((p) => ({
        id: p.id, name: p.name, status: p.status,
        serviceLine: p.serviceLine?.name || "—",
        employer: p.employer?.fullName || "—",
        supervisor: p.supervisor?.fullName || "—",
        contractCount: p.contracts.length,
        contractAmount: p.contracts.reduce((s, c) => s + c.amount, 0),
        taskCount: p.tasks.length,
        doneTasks: p.tasks.filter((t) => t.status === "DONE").length,
        bottleneckCount: p.tasks.filter((t) => t.isBottleneck && t.status !== "DONE").length,
        phaseProgress: p.phases.length ? Math.round((p.phases.filter((ph) => ph.status === "DONE").length / p.phases.length) * 100) : 0,
      })),
      pendingApprovals: pendingApprovals.slice(0, 20),
      bottleneckTasks: bottleneckTasks.map((t) => ({
        id: t.id, title: t.title, project: t.project.name,
        assignee: t.assigneePerson?.fullName || "—",
        dueDate: t.dueDate, priority: t.priority,
      })),
      collectionSeries,
      checkAlerts: checkAlerts.map((c) => ({
        id: c.id, person: c.person.fullName, checkNumber: c.checkNumber,
        amount: c.amount, dueDate: c.dueDate, status: c.status,
        daysLeft: Math.ceil((c.dueDate.getTime() - now) / 86400000),
      })),
      escalations: escalations.slice(0, 10),
      notifications: notifications.slice(0, 10),
      smsLog: await db.notification.findMany({ where: { tenantId, channel: "SMS" }, orderBy: { sentAt: "desc" }, take: 10 }),
    });
  });
}
