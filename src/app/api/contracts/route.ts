import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";
import { computeCommission, CommissionTierInput } from "@/lib/engines/commission";

// قراردادها (ماژول ۳) — تفکیک دستمزدی/بامصالح + موتور پورسانت
export async function GET() {
  return withAuth(async (session) => {
    const contracts = await db.contract.findMany({
      where: { tenantId: session.tenantId },
      include: {
        project: { include: { employer: true } },
        marketer: true,
        installments: true,
        materialItems: true,
        payouts: true,
        commissions: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ contracts });
  }, "contracts.view");
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const contract = await db.contract.create({
        data: {
          tenantId: session.tenantId,
          projectId: body.projectId,
          type: body.type === "WITH_MATERIALS" ? "WITH_MATERIALS" : "WAGE",
          signingMode: body.signingMode === "MULTI" ? "MULTI" : "SINGLE",
          title: body.title,
          amount: Number(body.amount) || 0,
          marketerId: body.marketerId || null,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          notes: body.notes || "",
          materialItems: {
            create: (body.materialItems || []).map((m: { name: string; unit?: string; unitPrice: number; plannedQty: number }) => ({
              tenantId: session.tenantId,
              name: m.name,
              unit: m.unit || "عدد",
              unitPrice: Number(m.unitPrice) || 0,
              plannedQty: Number(m.plannedQty) || 0,
            })),
          },
          installments: {
            create: (body.installments || []).map((i: { title: string; amount: number; dueDate: string }) => ({
              tenantId: session.tenantId,
              title: i.title,
              amount: Number(i.amount) || 0,
              dueDate: new Date(i.dueDate),
            })),
          },
        },
      });

      // ── موتور پورسانت: ایجاد خودکار پورسانت پلکانی ──
      if (body.marketerId) {
        const tiers = await db.commissionTier.findMany({ where: { tenantId: session.tenantId }, orderBy: { order: "asc" } });
        if (tiers.length) {
          const signShareSetting = await db.setting.findUnique({ where: { key: "COMMISSION_SIGN_SHARE" } });
          const bonusSetting = await db.setting.findUnique({ where: { key: "COMMISSION_FIXED_BONUS" } });
          const tierInputs: CommissionTierInput[] = tiers.map((t) => ({ minAmount: t.minAmount, maxAmount: t.maxAmount, percent: t.percent, label: t.label }));
          const calc = computeCommission(
            Number(body.amount) || 0,
            tierInputs,
            signShareSetting ? parseFloat(signShareSetting.value) : 50,
            bonusSetting ? parseFloat(bonusSetting.value) : 0
          );
          await db.commission.create({
            data: {
              tenantId: session.tenantId,
              contractId: contract.id,
              marketerId: body.marketerId,
              contractAmount: Number(body.amount) || 0,
              percent: calc.percent,
              totalAmount: calc.totalAmount,
              signPart: calc.signPart,
              collectionTarget: calc.collectionTarget,
            },
          });
        }
      }

      await audit(session.tenantId, session.userId, "CREATE", "Contract", contract.id, { title: contract.title, amount: contract.amount });
      return NextResponse.json({ contract });
    },
    "contracts.manage"
  );
}
