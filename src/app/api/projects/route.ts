import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

export async function GET() {
  return withAuth(async (session) => {
    const where = session.roleKey === "MARKETER" && session.tenantId
      ? { tenantId: session.tenantId }
      : { tenantId: session.tenantId };
    const projects = await db.project.findMany({
      where,
      include: {
        employer: true, supervisor: true, serviceLine: true,
        contracts: {
          include: {
            installments: { include: { paymentLinks: true, payments: true } },
            marketer: true,
            commissions: { include: { marketer: true } },
            materialItems: { include: { receipts: true } },
            balances: { include: { materialItem: true, phase: true } },
            workLogs: { include: { team: true, person: true, phase: true, evidences: true } },
            payouts: { include: { team: true } },
          },
        },
        phases: { include: { balances: true }, orderBy: { order: "asc" } },
        tasks: { include: { assigneePerson: true }, orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    // بازاریاب فقط پروژه‌های دارای قرارداد با خودش را می‌بیند
    const visible = session.roleKey === "MARKETER"
      ? projects.filter((p) => p.contracts.some((c) => c.marketerId && session.personId && c.marketerId === session.personId))
      : projects;
    return NextResponse.json({ projects: visible });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const project = await db.project.create({
        data: {
          tenantId: session.tenantId,
          name: body.name,
          code: body.code || "",
          employerId: body.employerId || null,
          supervisorId: body.supervisorId || null,
          serviceLineId: body.serviceLineId || null,
          address: body.address || "",
          status: body.status || "ACTIVE",
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          budget: body.budget ? Number(body.budget) : null,
          notes: body.notes || "",
          phases: {
            create: (body.phases || []).map((t: string, i: number) => ({ title: t, order: i + 1 })),
          },
        },
        include: { phases: true },
      });
      await audit(session.tenantId, session.userId, "CREATE", "Project", project.id, { name: project.name });
      return NextResponse.json({ project });
    },
    "projects.manage"
  );
}
