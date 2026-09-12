import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";

// اعلان‌های درون‌برنامه‌ای + لاگ پیامک‌ها
export async function GET(req: NextRequest) {
  return withAuth(async (session) => {
    const url = new URL(req.url);
    const channel = url.searchParams.get("channel");
    const where: Record<string, unknown> = { tenantId: session.tenantId };
    if (channel) where.channel = channel;
    const notifications = await db.notification.findMany({
      where,
      orderBy: { sentAt: "desc" },
      take: 60,
    });
    const unread = await db.notification.count({ where: { tenantId: session.tenantId, channel: "IN_APP", status: "SENT" } });
    return NextResponse.json({ notifications, unread });
  });
}

// علامت‌گذاری خوانده‌شده
export async function PATCH() {
  return withAuth(async (session) => {
    await db.notification.updateMany({
      where: { tenantId: session.tenantId, channel: "IN_APP", status: "SENT" },
      data: { status: "READ", readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
