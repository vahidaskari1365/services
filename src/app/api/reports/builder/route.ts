// گزارش‌ساز — تولید گزارش پویا از ۷ مجموعه‌داده با فیلتر پروژه/وضعیت/بازه زمانی
// مجوز: reports.build
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, fail } from "@/lib/api-helpers";
import { formatJalali } from "@/lib/jalali";

interface ColMeta {
  key: string;
  label: string;
  type: "text" | "money" | "date" | "status" | "number";
}

const PERIODS: Record<string, number | null> = {
  all: null,
  d30: 30,
  m3: 90,
  y1: 365,
};

const DATASETS: Record<string, { label: string; dateField: string; statuses?: string[] }> = {
  projects: { label: "پروژه‌ها", dateField: "createdAt" },
  contracts: { label: "قراردادها", dateField: "createdAt" },
  installments: { label: "اقساط قراردادها", dateField: "dueDate" },
  payments: { label: "پرداخت‌ها و وصولی‌ها", dateField: "paidAt" },
  worklogs: { label: "کارکردها", dateField: "date" },
  tasks: { label: "وظایف", dateField: "dueDate" },
  commissions: { label: "پورسانت‌ها", dateField: "createdAt" },
};

function periodWhere(period: string, dateField: string) {
  const days = PERIODS[period] ?? null;
  if (!days) return {};
  return { [dateField]: { gte: new Date(Date.now() - days * 86400000) } };
}

function j(value: Date | null | undefined): string {
  return value ? formatJalali(value) : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildDataset(dataset: string, tenantId: string, projectId: string | null, status: string | null, period: string) {
  const meta = DATASETS[dataset];
  if (!meta) return null;
  const pw = periodWhere(period, meta.dateField);
  const projectFilter = projectId ? { projectId } : {};

  if (dataset === "projects") {
    const rows = await db.project.findMany({
      where: { tenantId, ...pw, ...(projectId ? { id: projectId } : {}) },
      include: { serviceLine: true, employer: true, _count: { select: { contracts: true, tasks: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return {
      columns: [
        { key: "name", label: "نام پروژه", type: "text" },
        { key: "code", label: "کد", type: "text" },
        { key: "serviceLine", label: "رسته کاری", type: "text" },
        { key: "employer", label: "کارفرما", type: "text" },
        { key: "status", label: "وضعیت", type: "status" },
        { key: "budget", label: "بودجه", type: "money" },
        { key: "contractsCount", label: "تعداد قرارداد", type: "number" },
        { key: "tasksCount", label: "تعداد وظیفه", type: "number" },
        { key: "createdAt", label: "تاریخ ثبت", type: "date" },
      ] as ColMeta[],
      rows: rows.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code || "—",
        serviceLine: p.serviceLine?.name || "—",
        employer: p.employer?.fullName || "—",
        status: p.status,
        budget: p.budget ?? 0,
        contractsCount: p._count.contracts,
        tasksCount: p._count.tasks,
        createdAt: j(p.createdAt),
      })),
    };
  }

  if (dataset === "contracts") {
    const rows = await db.contract.findMany({
      where: { tenantId, ...projectFilter, ...pw, ...(status ? { status } : {}) },
      include: { project: true, marketer: true, _count: { select: { installments: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return {
      columns: [
        { key: "title", label: "عنوان قرارداد", type: "text" },
        { key: "project", label: "پروژه", type: "text" },
        { key: "type", label: "نوع قرارداد", type: "status" },
        { key: "status", label: "وضعیت", type: "status" },
        { key: "amount", label: "مبلغ", type: "money" },
        { key: "marketer", label: "بازاریاب", type: "text" },
        { key: "installmentsCount", label: "تعداد اقساط", type: "number" },
        { key: "createdAt", label: "تاریخ عقد", type: "date" },
      ] as ColMeta[],
      rows: rows.map((c) => ({
        id: c.id,
        title: c.title,
        project: c.project.name,
        type: c.type,
        status: c.status,
        amount: c.amount,
        marketer: c.marketer?.fullName || "—",
        installmentsCount: c._count.installments,
        createdAt: j(c.createdAt),
      })),
    };
  }

  if (dataset === "installments") {
    const rows = await db.contractInstallment.findMany({
      where: { tenantId, ...projectFilter, ...pw, ...(status ? { status } : {}) },
      include: { contract: { include: { project: true } } },
      orderBy: { dueDate: "desc" },
      take: 1000,
    });
    return {
      columns: [
        { key: "title", label: "عنوان قسط", type: "text" },
        { key: "contract", label: "قرارداد", type: "text" },
        { key: "project", label: "پروژه", type: "text" },
        { key: "amount", label: "مبلغ قسط", type: "money" },
        { key: "status", label: "وضعیت", type: "status" },
        { key: "dueDate", label: "سررسید", type: "date" },
        { key: "paidAt", label: "تاریخ پرداخت", type: "date" },
      ] as ColMeta[],
      rows: rows.map((i) => ({
        id: i.id,
        title: i.title,
        contract: i.contract.title,
        project: i.contract.project.name,
        amount: i.amount,
        status: i.status,
        dueDate: j(i.dueDate),
        paidAt: j(i.paidAt),
      })),
    };
  }

  if (dataset === "payments") {
    const rows = await db.payment.findMany({
      where: { tenantId, status: "SUCCESS", ...pw, ...(projectId ? { installment: { contract: { projectId } } } : {}) },
      include: { installment: { include: { contract: { include: { project: true } } } } },
      orderBy: { paidAt: "desc" },
      take: 1000,
    });
    return {
      columns: [
        { key: "amount", label: "مبلغ", type: "money" },
        { key: "method", label: "روش پرداخت", type: "status" },
        { key: "installment", label: "قسط", type: "text" },
        { key: "project", label: "پروژه", type: "text" },
        { key: "note", label: "توضیح", type: "text" },
        { key: "paidAt", label: "تاریخ پرداخت", type: "date" },
      ] as ColMeta[],
      rows: rows.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        installment: p.installment?.title || "—",
        project: p.installment?.contract.project.name || "—",
        note: p.note || "—",
        paidAt: j(p.paidAt),
      })),
    };
  }

  if (dataset === "worklogs") {
    const rows = await db.workLog.findMany({
      where: { tenantId, ...projectFilter, ...pw, ...(status ? { status } : {}) },
      include: { project: true, contract: true, person: true, team: true },
      orderBy: { date: "desc" },
      take: 1000,
    });
    return {
      columns: [
        { key: "date", label: "تاریخ", type: "date" },
        { key: "person", label: "شخص", type: "text" },
        { key: "team", label: "اکیپ", type: "text" },
        { key: "project", label: "پروژه", type: "text" },
        { key: "description", label: "شرح کار", type: "text" },
        { key: "computedAmount", label: "مبلغ کارکرد", type: "money" },
        { key: "status", label: "وضعیت", type: "status" },
      ] as ColMeta[],
      rows: rows.map((w) => ({
        id: w.id,
        date: j(w.date),
        person: w.person?.fullName || "—",
        team: w.team?.name || "—",
        project: w.project.name,
        description: w.description || "—",
        computedAmount: w.computedAmount,
        status: w.status,
      })),
    };
  }

  if (dataset === "tasks") {
    const rows = await db.task.findMany({
      where: { tenantId, ...projectFilter, ...pw, ...(status ? { status } : {}) },
      include: { project: true, assigneePerson: true },
      orderBy: { dueDate: "desc" },
      take: 1000,
    });
    return {
      columns: [
        { key: "title", label: "عنوان وظیفه", type: "text" },
        { key: "project", label: "پروژه", type: "text" },
        { key: "assignee", label: "مسئول", type: "text" },
        { key: "priority", label: "اولویت", type: "status" },
        { key: "status", label: "وضعیت", type: "status" },
        { key: "bottleneck", label: "گلوگاه", type: "text" },
        { key: "dueDate", label: "مهلت", type: "date" },
      ] as ColMeta[],
      rows: rows.map((t) => ({
        id: t.id,
        title: t.title,
        project: t.project.name,
        assignee: t.assigneePerson?.fullName || "—",
        priority: t.priority,
        status: t.status,
        bottleneck: t.isBottleneck ? "بله" : "خیر",
        dueDate: j(t.dueDate),
      })),
    };
  }

  // commissions
  const rows = await db.commission.findMany({
    where: { tenantId, ...pw, ...(projectId ? { contract: { projectId } } : {}), ...(status ? { status } : {}) },
    include: { marketer: true, contract: { include: { project: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    columns: [
      { key: "marketer", label: "بازاریاب", type: "text" },
      { key: "contract", label: "قرارداد", type: "text" },
      { key: "project", label: "پروژه", type: "text" },
      { key: "contractAmount", label: "مبلغ قرارداد", type: "money" },
      { key: "percent", label: "درصد", type: "number" },
      { key: "totalAmount", label: "پورسانت کل", type: "money" },
      { key: "paid", label: "پرداخت‌شده", type: "money" },
      { key: "status", label: "وضعیت", type: "status" },
    ] as ColMeta[],
    rows: rows.map((c) => ({
      id: c.id,
      marketer: c.marketer.fullName,
      contract: c.contract.title,
      project: c.contract.project.name,
      contractAmount: c.contractAmount,
      percent: c.percent,
      totalAmount: c.totalAmount,
      paid: (c.signPaid ? c.signPart : 0) + c.collectionPaid,
      status: c.status,
    })),
  };
}

export async function POST(req: NextRequest) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    if (!body) return fail("داده نامعتبر است");
    const dataset = String(body.dataset || "");
    if (!DATASETS[dataset]) return fail("نوع گزارش نامعتبر است");
    const projectId = body.projectId ? String(body.projectId) : null;
    const status = body.status ? String(body.status) : null;
    const period = String(body.period || "all");

    const result = await buildDataset(dataset, session.tenantId, projectId, status, period);
    if (!result) return fail("نوع گزارش نامعتبر است");
    return NextResponse.json({ dataset, datasetLabel: DATASETS[dataset].label, ...result });
  }, "reports.build");
}

// فهرست مجموعه‌داده‌ها برای منوی گزارش‌ساز
export async function GET() {
  return withAuth(async (session) => {
    const projects = await db.project.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      datasets: Object.entries(DATASETS).map(([key, v]) => ({ key, label: v.label })),
      projects,
    });
  }, "reports.build");
}
