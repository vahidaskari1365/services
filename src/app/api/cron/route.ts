import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";
import { runEscalationEngine } from "@/lib/engines/escalation";

// اجرای دستی موتور پیگیری (معادل Cron Job) — از پنل تنظیمات هم قابل اجراست
export async function POST() {
  return withAuth(async (session) => {
    const result = await runEscalationEngine(session.tenantId);
    await db.setting.upsert({
      where: { key: "ENGINE_LAST_RUN" },
      create: { tenantId: session.tenantId, key: "ENGINE_LAST_RUN", value: new Date().toISOString(), group: "SYSTEM", label: "آخرین اجرای موتور" },
      update: { value: new Date().toISOString() },
    });
    return NextResponse.json({ ok: true, result });
  }, "settings.manage");
}

export async function GET() {
  return withAuth(async (session) => {
    const lastRun = await db.setting.findUnique({ where: { key: "ENGINE_LAST_RUN" } });
    return NextResponse.json({ lastRun: lastRun?.value || null });
  });
}
