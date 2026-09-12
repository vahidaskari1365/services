import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";

// کارتابل ارجاعات منشی (Escalation Queue)
export async function GET(req: NextRequest) {
  return withAuth(async (session) => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "OPEN";
    const escalations = await db.escalation.findMany({
      where: { tenantId: session.tenantId, ...(status !== "ALL" ? { status } : {}) },
      include: { callLogs: { orderBy: { createdAt: "desc" } } },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ escalations });
  }, "escalations.view");
}
