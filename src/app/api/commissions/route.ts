import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";
import { collectionShare } from "@/lib/engines/commission";
import { materialCollectionRatio } from "@/lib/engines/hardgate";

// پورسانت بازاریابان — محاسبه پویا
export async function GET() {
  return withAuth(async (session) => {
    const commissions = await db.commission.findMany({
      where: { tenantId: session.tenantId },
      include: { contract: { include: { project: true } }, marketer: true },
      orderBy: { createdAt: "desc" },
    });
    const tiers = await db.commissionTier.findMany({ where: { tenantId: session.tenantId }, orderBy: { order: "asc" } });

    // فیلتر بازاریاب: فقط پورسانت خودش
    const visible = session.roleKey === "MARKETER" && session.personId
      ? commissions.filter((c) => c.marketerId === session.personId)
      : commissions;

    // محاسبه سهم وصول روز برای هر پورسانت (متناسب با وصول مصالح)
    const enriched = await Promise.all(
      visible.map(async (c) => {
        const ratio = await materialCollectionRatio(c.contractId);
        const currentShare = collectionShare(c.collectionTarget, ratio);
        return { ...c, collectionRatio: Math.round(ratio * 100), currentCollectionShare: currentShare };
      })
    );

    // بازاریاب خودش بتواند برای قراردادش پورسانت را قطعی ببیند
    return NextResponse.json({ commissions: enriched, tiers });
  }, "commissions.view");
}

// پرداخت بخشی از پورسانت (مدیر/حسابدار)
export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const commission = await db.commission.findUnique({ where: { id: body.id } });
      if (!commission || commission.tenantId !== session.tenantId) {
        return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
      }
      let updated = commission;
      if (body.kind === "sign") {
        updated = await db.commission.update({ where: { id: commission.id }, data: { signPaid: true } });
      } else if (body.kind === "collection") {
        const ratio = await materialCollectionRatio(commission.contractId);
        const due = collectionShare(commission.collectionTarget, ratio) - commission.collectionPaid;
        if (due <= 0) return NextResponse.json({ error: "سهم وصولی قابل پرداخت وجود ندارد" }, { status: 400 });
        const totalPaid = commission.collectionPaid + due;
        updated = await db.commission.update({
          where: { id: commission.id },
          data: { collectionPaid: totalPaid, status: totalPaid >= commission.collectionTarget - 1 ? "PAID" : "PARTIAL" },
        });
      }
      await audit(session.tenantId, session.userId, "PAY_COMMISSION", "Commission", commission.id, { kind: body.kind });
      return NextResponse.json({ commission: updated });
    },
    "finance.manage"
  );
}
