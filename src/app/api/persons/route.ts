import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

export async function GET() {
  return withAuth(async (session) => {
    const persons = await db.person.findMany({
      where: { tenantId: session.tenantId },
      include: {
        guaranteeChecks: true,
        teamsLed: { include: { members: true, serviceLine: true } },
        memberships: { include: { team: true } },
        _count: { select: { projectsAsEmployer: true, projectsAsSupervisor: true, contractsAsMarketer: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ persons });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const person = await db.person.create({
        data: {
          tenantId: session.tenantId,
          type: body.type || "EMPLOYER",
          fullName: body.fullName,
          phone: body.phone || "",
          nationalId: body.nationalId || "",
          address: body.address || "",
          marketerCode: body.marketerCode || "",
          defaultPercent: body.defaultPercent ? Number(body.defaultPercent) : null,
          notes: body.notes || "",
        },
      });
      await audit(session.tenantId, session.userId, "CREATE", "Person", person.id, { name: person.fullName });
      return NextResponse.json({ person });
    },
    "persons.manage"
  );
}
