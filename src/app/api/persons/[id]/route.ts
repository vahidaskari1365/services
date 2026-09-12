import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAuth(
    async (session) => {
      const { id } = await params;
      const body = await req.json();
      const person = await db.person.update({
        where: { id },
        data: {
          fullName: body.fullName,
          phone: body.phone,
          nationalId: body.nationalId,
          address: body.address,
          notes: body.notes,
          isActive: body.isActive,
          defaultPercent: body.defaultPercent !== undefined ? Number(body.defaultPercent) : undefined,
        },
      });
      await audit(session.tenantId, session.userId, "UPDATE", "Person", id);
      return NextResponse.json({ person });
    },
    "persons.manage"
  );
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withAuth(
    async (session) => {
      const { id } = await params;
      await db.person.update({ where: { id }, data: { isActive: false } });
      await audit(session.tenantId, session.userId, "DEACTIVATE", "Person", id);
      return NextResponse.json({ ok: true });
    },
    "persons.manage"
  );
}
