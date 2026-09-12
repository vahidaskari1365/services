import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// ثبت نتیجه تماس / بستن ارجاع
export async function POST(req: NextRequest, { params }: Params) {
  return withAuth(
    async (session) => {
      const { id } = await params;
      const body = await req.json();
      const escalation = await db.escalation.findUnique({ where: { id } });
      if (!escalation || escalation.tenantId !== session.tenantId) {
        return NextResponse.json({ error: "ارجاع یافت نشد" }, { status: 404 });
      }
      const callLog = await db.callLog.create({
        data: {
          tenantId: session.tenantId,
          escalationId: id,
          byUserId: session.userId,
          result: body.result || "ANSWERED",
          note: body.note || "",
          nextFollowUpAt: body.nextFollowUpAt ? new Date(body.nextFollowUpAt) : null,
        },
      });
      await audit(session.tenantId, session.userId, "CALL_LOG", "Escalation", id, { result: body.result });
      return NextResponse.json({ callLog });
    },
    "escalations.handle"
  );
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAuth(
    async (session) => {
      const { id } = await params;
      const body = await req.json();
      const escalation = await db.escalation.update({
        where: { id },
        data: {
          status: body.status || "DONE",
          resultNote: body.resultNote || "",
          resultAt: body.status === "DONE" ? new Date() : null,
        },
      });
      await audit(session.tenantId, session.userId, "RESOLVE_ESCALATION", "Escalation", id);
      return NextResponse.json({ escalation });
    },
    "escalations.handle"
  );
}
