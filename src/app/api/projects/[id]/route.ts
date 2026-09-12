import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";
import { evaluateHardGate } from "@/lib/engines/hardgate";

type Params = { params: Promise<{ id: string }> };

// جزئیات پروژه: قراردادها، مراحل، وظایف، کارکردها و وضعیت سد سخت
export async function GET(_req: NextRequest, { params }: Params) {
  return withAuth(async (session) => {
    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      include: {
        employer: true, supervisor: true, serviceLine: true,
        contracts: {
          include: {
            marketer: true,
            installments: { include: { paymentLinks: true, payments: true } },
            materialItems: { include: { receipts: true, balances: { include: { phase: true } } } },
            balances: { include: { materialItem: true, phase: true } },
            workLogs: { include: { team: true, person: true, phase: true, evidences: true } },
            payouts: { include: { team: true } },
            commissions: { include: { marketer: true } },
          },
        },
        phases: { include: { balances: true }, orderBy: { order: "asc" } },
        tasks: { include: { assigneePerson: true }, orderBy: { dueDate: "asc" } },
      },
    });
    if (!project) return NextResponse.json({ error: "پروژه یافت نشد" }, { status: 404 });

    // وضعیت سد سخت برای هر قرارداد
    const gates: Record<string, Awaited<ReturnType<typeof evaluateHardGate>>> = {};
    for (const c of project.contracts) {
      if (c.type === "WITH_MATERIALS") gates[c.id] = await evaluateHardGate(c.id);
    }
    return NextResponse.json({ project, gates });
  }, "projects.view");
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAuth(
    async (session) => {
      const { id } = await params;
      const body = await req.json();
      const project = await db.project.update({
        where: { id },
        data: {
          name: body.name,
          status: body.status,
          address: body.address,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          notes: body.notes,
        },
      });
      await audit(session.tenantId, session.userId, "UPDATE", "Project", id);
      return NextResponse.json({ project });
    },
    "projects.manage"
  );
}

// افزودن مرحله جدید
export async function POST(req: NextRequest, { params }: Params) {
  return withAuth(
    async (session) => {
      const { id } = await params;
      const body = await req.json();
      const count = await db.phase.count({ where: { projectId: id } });
      const phase = await db.phase.create({
        data: { projectId: id, title: body.title, order: count + 1 },
      });
      await audit(session.tenantId, session.userId, "CREATE", "Phase", phase.id);
      return NextResponse.json({ phase });
    },
    "projects.manage"
  );
}
