import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

// تنظیمات — همه فرمول‌ها، تعرفه‌ها، پترن‌ها و آستانه‌ها به صورت داده (نه کد هارد)
export async function GET() {
  return withAuth(async (session) => {
    const [settings, tiers, templates, roles] = await Promise.all([
      db.setting.findMany({ where: { tenantId: session.tenantId }, orderBy: [{ group: "asc" }, { key: "asc" }] }),
      db.commissionTier.findMany({ where: { tenantId: session.tenantId }, orderBy: { order: "asc" } }),
      db.smsTemplate.findMany({ where: { tenantId: session.tenantId }, orderBy: { key: "asc" } }),
      db.role.findMany({
        where: { tenantId: session.tenantId },
        include: { permissions: true, users: { select: { id: true, fullName: true } } },
        orderBy: { key: "asc" },
      }),
    ]);
    return NextResponse.json({ settings, tiers, templates, roles });
  });
}

// ذخیره دسته‌ای تنظیمات: { settings: [{key, value}], tiers: [...], templates: [...] }
export async function PUT(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();

      for (const s of body.settings || []) {
        await db.setting.update({
          where: { key: s.key },
          data: { value: String(s.value) },
        });
      }

      if (body.tiers) {
        await db.commissionTier.deleteMany({ where: { tenantId: session.tenantId } });
        let order = 1;
        for (const t of body.tiers) {
          await db.commissionTier.create({
            data: {
              tenantId: session.tenantId,
              label: t.label || `پلکان ${order}`,
              minAmount: Number(t.minAmount) || 0,
              maxAmount: t.maxAmount === null || t.maxAmount === "" ? null : Number(t.maxAmount),
              percent: Number(t.percent) || 0,
              order: order++,
            },
          });
        }
      }

      for (const t of body.templates || []) {
        await db.smsTemplate.update({ where: { id: t.id }, data: { body: t.body, enabled: t.enabled } });
      }

      if (body.rolePermissions) {
        // { roleId: permissionKeys[] }
        for (const [roleId, keys] of Object.entries(body.rolePermissions)) {
          const role = await db.role.findUnique({ where: { id: roleId } });
          if (!role || role.tenantId !== session.tenantId) continue;
          await db.role.update({
            where: { id: roleId },
            data: { permissions: { set: (keys as string[]).map((k) => ({ key: k })) } },
          });
        }
      }

      await audit(session.tenantId, session.userId, "UPDATE_SETTINGS", "Setting");
      return NextResponse.json({ ok: true });
    },
    "settings.manage"
  );
}
