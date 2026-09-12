import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

// اکیپ‌ها + چک‌های ضمانت (ماژول ۲ CRM)
export async function GET() {
  return withAuth(async (session) => {
    const teams = await db.team.findMany({
      where: { tenantId: session.tenantId },
      include: {
        leader: true,
        serviceLine: true,
        members: { include: { person: true } },
        workLogs: { where: { status: "APPROVED" } },
        payouts: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const checks = await db.guaranteeCheck.findMany({
      where: { tenantId: session.tenantId },
      include: { person: true },
      orderBy: { dueDate: "asc" },
    });
    return NextResponse.json({ teams, checks });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      if (body.kind === "check") {
        // ثبت چک ضمانت جدید
        const check = await db.guaranteeCheck.create({
          data: {
            tenantId: session.tenantId,
            personId: body.personId,
            checkNumber: body.checkNumber,
            amount: Number(body.amount),
            bankName: body.bankName || "",
            dueDate: new Date(body.dueDate),
            notes: body.notes || "",
          },
        });
        await audit(session.tenantId, session.userId, "CREATE", "GuaranteeCheck", check.id);
        return NextResponse.json({ check });
      }
      // ایجاد اکیپ
      const team = await db.team.create({
        data: {
          tenantId: session.tenantId,
          name: body.name,
          leaderId: body.leaderId || null,
          serviceLineId: body.serviceLineId || null,
          notes: body.notes || "",
          members: {
            create: (body.memberIds || []).map((pid: string) => ({ personId: pid })),
          },
        },
      });
      await audit(session.tenantId, session.userId, "CREATE", "Team", team.id, { name: team.name });
      return NextResponse.json({ team });
    },
    "teams.manage"
  );
}
