import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

// هاب مالی — اقساط، لینک پرداخت آنلاین (شبیه‌سازی درگاه شاپرک)
export async function GET(req: NextRequest) {
  return withAuth(async (session) => {
    const url = new URL(req.url);
    const contractId = url.searchParams.get("contractId");
    const installments = await db.contractInstallment.findMany({
      where: { tenantId: session.tenantId, ...(contractId ? { contractId } : {}) },
      include: { contract: { include: { project: { include: { employer: true } } } }, paymentLinks: true, payments: true },
      orderBy: { dueDate: "asc" },
    });
    const payments = await db.payment.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { paidAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ installments, payments });
  }, "finance.view");
}

// صدور لینک پرداخت با مبلغ غیرقابل تغییر
export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const inst = await db.contractInstallment.findUnique({
        where: { id: body.installmentId },
        include: { contract: { include: { project: { include: { employer: true } } } } },
      });
      if (!inst || inst.tenantId !== session.tenantId) {
        return NextResponse.json({ error: "قسط یافت نشد" }, { status: 404 });
      }
      if (inst.status === "PAID") return NextResponse.json({ error: "این قسط قبلاً پرداخت شده" }, { status: 400 });

      const token = crypto.randomBytes(16).toString("hex");
      const link = await db.paymentLink.create({
        data: {
          tenantId: session.tenantId,
          token,
          installmentId: inst.id,
          title: `پرداخت قسط «${inst.title}» — پروژه ${inst.contract.project.name}`,
          amount: inst.amount,
          payerName: inst.contract.project.employer?.fullName || "",
        },
      });
      await audit(session.tenantId, session.userId, "CREATE_PAYMENT_LINK", "PaymentLink", link.id, { amount: inst.amount });
      return NextResponse.json({ link });
    },
    "payments.link"
  );
}

// ثبت پرداخت دستی (نقدی/کارت‌خوان) توسط حسابدار
export async function PUT(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const inst = await db.contractInstallment.findUnique({ where: { id: body.installmentId } });
      if (!inst || inst.tenantId !== session.tenantId) {
        return NextResponse.json({ error: "قسط یافت نشد" }, { status: 404 });
      }
      if (inst.status === "PAID") return NextResponse.json({ error: "قبلاً پرداخت شده" }, { status: 400 });

      const payment = await db.payment.create({
        data: {
          tenantId: session.tenantId,
          installmentId: inst.id,
          amount: inst.amount,
          method: body.method === "CASH" ? "CASH" : body.method === "TRANSFER" ? "TRANSFER" : "GATEWAY",
          gatewayRef: body.gatewayRef || `SIM-${Date.now()}`,
          note: body.note || "",
        },
      });
      await db.contractInstallment.update({
        where: { id: inst.id },
        data: { status: "PAID", paidAt: new Date(), paymentId: payment.id },
      });
      await db.paymentLink.updateMany({ where: { installmentId: inst.id, status: "ACTIVE" }, data: { status: "CANCELLED" } });
      await audit(session.tenantId, session.userId, "REGISTER_PAYMENT", "Payment", payment.id, { amount: inst.amount });
      return NextResponse.json({ payment });
    },
    "finance.manage"
  );
}

// همگام‌سازی با نرم‌افزار حسابداری (حسابفاری) — شبیه‌سازی API/Webhook
export async function PATCH() {
  return withAuth(
    async (session) => {
      const unsynced = await db.payment.findMany({ where: { tenantId: session.tenantId, accountingSynced: false, status: "SUCCESS" } });
      let synced = 0;
      for (const p of unsynced) {
        await db.payment.update({
          where: { id: p.id },
          data: { accountingSynced: true, accountingRef: `HESABFA-${crypto.randomBytes(4).toString("hex").toUpperCase()}` },
        });
        synced++;
      }
      await audit(session.tenantId, session.userId, "ACCOUNTING_SYNC", "Payment", null, { synced });
      return NextResponse.json({ ok: true, syncedCount: synced, note: "اسناد مالی به حسابفاری ارسال شد (شبیه‌سازی Webhook)" });
    },
    "accounting.sync"
  );
}
