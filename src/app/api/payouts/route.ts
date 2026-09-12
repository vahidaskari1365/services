import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";
import { evaluateHardGate } from "@/lib/engines/hardgate";

// تسویه اکیپ/سرپرست — با اعمال سد سخت تراز مصالح (Hard Gate)
export async function GET() {
  return withAuth(async (session) => {
    const payouts = await db.payout.findMany({
      where: { tenantId: session.tenantId },
      include: { contract: { include: { project: true } }, team: { include: { members: { include: { person: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ payouts });
  }, "finance.view");
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const { contractId, type } = body;

      // ── سد سخت تراز مصالح ──
      const gate = await evaluateHardGate(contractId);
      if (gate.contractType === "WITH_MATERIALS" && !gate.passed) {
        return NextResponse.json(
          {
            error: gate.message,
            gate: {
              passed: false,
              missingCount: gate.missingItems.length,
              missingItems: gate.missingItems.slice(0, 10),
            },
          },
          { status: 423 } // Locked
        );
      }

      const payout = await db.payout.create({
        data: {
          tenantId: session.tenantId,
          type: type === "SUPERVISOR" ? "SUPERVISOR" : "TEAM",
          contractId,
          teamId: body.teamId || null,
          personId: body.personId || null,
          wageAmount: gate.wageTotal,
          deductions: gate.totalShortage,
          additions: Number(body.additions) || 0,
          netAmount: Math.max(0, gate.netPayable + (Number(body.additions) || 0)),
          hardGatePassed: true,
          status: "PENDING_APPROVAL",
          requestedBy: session.userId,
        },
      });

      await db.approval.create({
        data: {
          tenantId: session.tenantId,
          type: "PAYOUT",
          refId: payout.id,
          title: `درخواست تسویه ${type === "SUPERVISOR" ? "سرپرست" : "اکیپ"} — ${payout.netAmount.toLocaleString("fa-IR")} ریال`,
          amount: payout.netAmount,
          meta: JSON.stringify({ payoutId: payout.id, contractId, shortage: gate.totalShortage }),
          requestedBy: session.userId,
        },
      });

      await audit(session.tenantId, session.userId, "REQUEST_PAYOUT", "Payout", payout.id, { net: payout.netAmount, shortage: gate.totalShortage });
      return NextResponse.json({ payout, gate });
    },
    "approvals.request"
  );
}

// پرداخت تسویه تاییدشده
export async function PATCH(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const payout = await db.payout.findUnique({ where: { id: body.id } });
      if (!payout || payout.tenantId !== session.tenantId) {
        return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
      }
      if (payout.status !== "APPROVED") {
        return NextResponse.json({ error: "فقط تسویه تاییدشده قابل پرداخت است" }, { status: 400 });
      }
      const updated = await db.payout.update({
        where: { id: payout.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      // کارکردهای مرتبط را تسویه‌شده علامت بزن
      await db.workLog.updateMany({
        where: { contractId: payout.contractId, status: "APPROVED", walletSettled: false },
        data: { walletSettled: true },
      });
      await audit(session.tenantId, session.userId, "PAY_PAYOUT", "Payout", payout.id);
      return NextResponse.json({ payout: updated });
    },
    "finance.manage"
  );
}
