import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";
import { evaluateHardGate } from "@/lib/engines/hardgate";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  return withAuth(async (session) => {
    const { id } = await params;
    const contract = await db.contract.findUnique({
      where: { id },
      include: {
        project: { include: { employer: true, phases: true } },
        marketer: true,
        installments: { include: { paymentLinks: true, payments: true }, orderBy: { dueDate: "asc" } },
        materialItems: { include: { receipts: true } },
        balances: { include: { materialItem: true, phase: true } },
        workLogs: { include: { team: true, person: true, phase: true, evidences: true }, orderBy: { date: "desc" } },
        payouts: { include: { team: true } },
        commissions: { include: { marketer: true } },
      },
    });
    if (!contract) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    const gate = await evaluateHardGate(id);
    return NextResponse.json({ contract, gate });
  }, "contracts.view");
}

// ثبت تراز مصالح (سرپرست) — پیش‌نیاز سد سخت
export async function POST(req: NextRequest, { params }: Params) {
  return withAuth(
    async (session) => {
      const { id } = await params;
      const body = await req.json();
      // body: { phaseId, balances: [{ materialItemId, consumedQty, surplusQty, shortageQty, notes }] }
      const contract = await db.contract.findUnique({ where: { id }, include: { materialItems: true, project: { include: { phases: true } } } });
      if (!contract) return NextResponse.json({ error: "قرارداد یافت نشد" }, { status: 404 });
      if (contract.type !== "WITH_MATERIALS") {
        return NextResponse.json({ error: "تراز مصالح فقط برای قرارداد بامصالح است" }, { status: 400 });
      }

      const phaseId = body.phaseId;
      // حذف ترازهای قبلی همین مرحله (بازنویسی)
      await db.materialBalance.deleteMany({ where: { contractId: id, phaseId } });

      for (const b of body.balances || []) {
        await db.materialBalance.create({
          data: {
            tenantId: session.tenantId,
            contractId: id,
            phaseId,
            materialItemId: b.materialItemId,
            recordedById: session.userId,
            consumedQty: Number(b.consumedQty) || 0,
            surplusQty: Number(b.surplusQty) || 0,
            shortageQty: Number(b.shortageQty) || 0,
            notes: b.notes || "",
          },
        });
      }

      // تاییدیه تراز برای مدیر (زنجیره تایید)
      await db.approval.create({
        data: {
          tenantId: session.tenantId,
          type: "MATERIAL_BALANCE",
          refId: `${id}:${phaseId}`,
          title: `تراز مصالح مرحله «${contract.project.phases.find((p) => p.id === phaseId)?.title || ""}» — ${contract.title}`,
          meta: JSON.stringify({ contractId: id, phaseId }),
          requestedBy: session.userId,
        },
      });

      await audit(session.tenantId, session.userId, "CREATE", "MaterialBalance", id, { phaseId });
      const gate = await evaluateHardGate(id);
      return NextResponse.json({ ok: true, gate });
    },
    "material.balance"
  );
}
