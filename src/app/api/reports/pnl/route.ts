import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";

// گزارش تحلیلی سود و زیان به تفکیک پروژه، رسته و بازاریاب (ماژول ۶)
export async function GET() {
  return withAuth(async (session) => {
    const tenantId = session.tenantId;
    const [projects, payments, worklogs, commissions, payouts] = await Promise.all([
      db.project.findMany({ where: { tenantId }, include: { serviceLine: true, contracts: { include: { commissions: true, marketer: true } } } }),
      db.payment.findMany({ where: { tenantId, status: "SUCCESS" }, include: { installment: { include: { contract: true } } } }),
      db.workLog.findMany({ where: { tenantId, status: "APPROVED" }, include: { contract: true } }),
      db.commission.findMany({ where: { tenantId }, include: { marketer: true } }),
      db.payout.findMany({ where: { tenantId, status: { in: ["PAID", "APPROVED"] } }, include: { contract: true } }),
    ]);

    const byProject = projects.map((p) => {
      const contractIds = p.contracts.map((c) => c.id);
      const revenue = payments
        .filter((pay) => pay.installment && contractIds.includes(pay.installment.contractId))
        .reduce((s, pay) => s + pay.amount, 0);
      const wages = worklogs.filter((w) => contractIds.includes(w.contractId)).reduce((s, w) => s + w.computedAmount, 0);
      const commission = commissions
        .filter((c) => contractIds.includes(c.contractId))
        .reduce((s, c) => s + (c.signPaid ? c.signPart : 0) + c.collectionPaid, 0);
      const profit = revenue - wages - commission;
      return {
        projectId: p.id,
        project: p.name,
        serviceLine: p.serviceLine?.name || "—",
        revenue,
        wages,
        commission,
        profit,
        margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      };
    });

    // به تفکیک رسته
    const byLineMap = new Map<string, { revenue: number; wages: number; commission: number; profit: number }>();
    for (const row of byProject) {
      const cur = byLineMap.get(row.serviceLine) || { revenue: 0, wages: 0, commission: 0, profit: 0 };
      cur.revenue += row.revenue;
      cur.wages += row.wages;
      cur.commission += row.commission;
      cur.profit += row.profit;
      byLineMap.set(row.serviceLine, cur);
    }
    const byLine = [...byLineMap.entries()].map(([name, v]) => ({ line: name, ...v }));

    // به تفکیک بازاریاب
    const byMarketerMap = new Map<string, { total: number; paid: number; contracts: number }>();
    for (const c of commissions) {
      const key = c.marketer.fullName;
      const cur = byMarketerMap.get(key) || { total: 0, paid: 0, contracts: 0 };
      cur.total += c.totalAmount;
      cur.paid += (c.signPaid ? c.signPart : 0) + c.collectionPaid;
      cur.contracts += 1;
      byMarketerMap.set(key, cur);
    }
    const byMarketer = [...byMarketerMap.entries()].map(([name, v]) => ({ marketer: name, ...v }));

    const totals = {
      revenue: byProject.reduce((s, r) => s + r.revenue, 0),
      wages: byProject.reduce((s, r) => s + r.wages, 0),
      commission: byProject.reduce((s, r) => s + r.commission, 0),
      profit: byProject.reduce((s, r) => s + r.profit, 0),
      payoutsCount: payouts.length,
    };

    return NextResponse.json({ byProject, byLine, byMarketer, totals });
  }, "reports.pnl");
}
