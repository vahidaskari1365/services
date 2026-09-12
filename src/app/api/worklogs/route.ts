import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";
import { computeTariff, TariffType } from "@/lib/engines/tariff";

// کارکردها (WorkLog) — ثبت با شواهد + موتور تعرفه
export async function GET(req: NextRequest) {
  return withAuth(async (session) => {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const status = url.searchParams.get("status");
    const where: Record<string, unknown> = { tenantId: session.tenantId };
    if (scope === "own" && session.personId) where.personId = session.personId;
    if (status) where.status = status;
    const workLogs = await db.workLog.findMany({
      where,
      include: { project: true, contract: true, phase: true, person: true, team: true, evidences: true },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ workLogs });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const tariffType = (["FIXED", "METERED", "BASE_PLUS_EXTRA"].includes(body.tariffType) ? body.tariffType : "FIXED") as TariffType;
      const calc = computeTariff({
        tariffType,
        baseAmount: Number(body.baseAmount) || 0,
        rate: Number(body.rate) || 0,
        quantity: Number(body.quantity) || 0,
        extraUnits: Number(body.extraUnits) || 0,
        extraRate: Number(body.extraRate) || 0,
      });
      const workLog = await db.workLog.create({
        data: {
          tenantId: session.tenantId,
          projectId: body.projectId,
          contractId: body.contractId,
          phaseId: body.phaseId || null,
          personId: session.personId || body.personId || null,
          teamId: body.teamId || null,
          date: body.date ? new Date(body.date) : new Date(),
          description: body.description || "",
          status: "PENDING",
          tariffType,
          baseAmount: Number(body.baseAmount) || 0,
          rate: Number(body.rate) || 0,
          quantity: Number(body.quantity) || 0,
          extraUnits: Number(body.extraUnits) || 0,
          extraRate: Number(body.extraRate) || 0,
          computedAmount: calc.amount,
          evidences: {
            create: (body.evidences || []).map((e: { kind: string; title?: string; value?: string }) => ({
              kind: e.kind,
              title: e.title || "",
              value: e.value || "",
            })),
          },
        },
        include: { evidences: true },
      });

      // تاییدیه زنجیره‌ای برای مدیر
      await db.approval.create({
        data: {
          tenantId: session.tenantId,
          type: "WORKLOG",
          refId: workLog.id,
          title: `کارکرد: ${body.description || "بدون شرح"} — ${calc.amount.toLocaleString("fa-IR")} ریال`,
          amount: calc.amount,
          meta: JSON.stringify({ workLogId: workLog.id, formula: calc.formula, contractId: body.contractId }),
          requestedBy: session.userId,
        },
      });

      await audit(session.tenantId, session.userId, "CREATE", "WorkLog", workLog.id, { amount: calc.amount, formula: calc.formula });
      return NextResponse.json({ workLog, formula: calc.formula });
    },
    "worklogs.create"
  );
}
