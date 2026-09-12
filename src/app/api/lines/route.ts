import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

// رسته‌های کاری (آب، گاز، برق، آتش‌نشانی، پلی‌اتیلن و…) — فقط از تنظیمات تعریف می‌شوند
export async function GET() {
  return withAuth(async (session) => {
    const lines = await db.serviceLine.findMany({
      where: { tenantId: session.tenantId },
      include: { _count: { select: { projects: true, teams: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ lines });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const line = await db.serviceLine.create({
        data: { tenantId: session.tenantId, name: body.name, code: body.code || "" },
      });
      await audit(session.tenantId, session.userId, "CREATE", "ServiceLine", line.id);
      return NextResponse.json({ line });
    },
    "settings.manage"
  );
}

export async function PATCH(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const line = await db.serviceLine.update({
        where: { id: body.id },
        data: { name: body.name, code: body.code, isActive: body.isActive },
      });
      await audit(session.tenantId, session.userId, "UPDATE", "ServiceLine", body.id);
      return NextResponse.json({ line });
    },
    "settings.manage"
  );
}
