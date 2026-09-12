import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";
import { evaluateHardGate } from "@/lib/engines/hardgate";

// مرکز عملیات — کارتابل تاییدیه‌ها با تایید/رد یک‌کلیکی
export async function GET() {
  return withAuth(async (session) => {
    const approvals = await db.approval.findMany({
      where: { tenantId: session.tenantId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({ approvals });
  }, "approvals.decide");
}

// تصمیم‌گیری: { id, decision: "APPROVED" | "REJECTED", note? }
export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const approval = await db.approval.findUnique({ where: { id: body.id } });
      if (!approval || approval.tenantId !== session.tenantId) {
        return NextResponse.json({ error: "تاییدیه یافت نشد" }, { status: 404 });
      }
      if (approval.status !== "PENDING") {
        return NextResponse.json({ error: "این تاییدیه قبلاً تعیین تکلیف شده" }, { status: 400 });
      }
      const decision = body.decision === "APPROVED" ? "APPROVED" : "REJECTED";

      await db.approval.update({
        where: { id: approval.id },
        data: { status: decision, decidedBy: session.userId, decidedAt: new Date(), note: body.note || "" },
      });

      // اعمال اثر تصمیم روی موجودیت مربوطه
      if (approval.type === "WORKLOG") {
        const meta = JSON.parse(approval.meta || "{}");
        await db.workLog.update({
          where: { id: meta.workLogId || approval.refId },
          data: {
            status: decision,
            approvedById: session.userId,
            approvedAt: new Date(),
          },
        });
      } else if (approval.type === "PAYOUT") {
        const meta = JSON.parse(approval.meta || "{}");
        if (decision === "APPROVED") {
          await db.payout.update({
            where: { id: approval.refId },
            data: { status: "APPROVED", approvedBy: session.userId, approvedAt: new Date() },
          });
        } else {
          await db.payout.update({
            where: { id: approval.refId },
            data: { status: "BLOCKED", blockReason: body.note || "رد شده توسط مدیر" },
          });
        }
        void meta;
      } else if (approval.type === "MATERIAL_BALANCE" && decision === "APPROVED") {
        const meta = JSON.parse(approval.meta || "{}");
        const gate = await evaluateHardGate(meta.contractId);
        await db.notification.create({
          data: {
            tenantId: session.tenantId,
            channel: "IN_APP",
            title: "تراز مصالح تایید شد",
            body: gate.passed ? gate.message : `${gate.message} — ${gate.missingItems.length} قلم باقی مانده`,
            refType: "contract",
            refId: meta.contractId,
          },
        });
      }

      await audit(session.tenantId, session.userId, `APPROVAL_${decision}`, "Approval", approval.id, { type: approval.type });
      return NextResponse.json({ ok: true, decision });
    },
    "approvals.decide"
  );
}
