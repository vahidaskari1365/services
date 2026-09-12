import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// تغییر وضعیت وظیفه توسط سرپرست/مدیر
export async function PATCH(req: NextRequest, { params }: Params) {
  return withAuth(async (session) => {
    const { id } = await params;
    const body = await req.json();
    const task = await db.task.update({
      where: { id },
      data: {
        status: body.status,
        completedAt: body.status === "DONE" ? new Date() : null,
      },
    });
    await audit(session.tenantId, session.userId, "UPDATE", "Task", id, { status: body.status });
    return NextResponse.json({ task });
  });
}
