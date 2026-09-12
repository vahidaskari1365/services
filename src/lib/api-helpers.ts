// ابزارهای مشترک API — گارد احراز هویت، چک دسترسی RBAC، پاسخ‌های JSON

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, SessionUser, AuthError } from "@/lib/auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withAuth(
  handler: (session: SessionUser) => Promise<NextResponse>,
  requiredPermission?: string
): Promise<NextResponse> {
  try {
    const raw = await getSession();
    if (!raw) return fail("احراز هویت لازم است", 401);
    // تکمیل personId از دیتابیس (برای فیلترهای نقش‌محور مثل «وظایف من»)
    const dbUser = await db.user.findUnique({ where: { id: raw.userId }, include: { role: { include: { permissions: true } } } });
    if (!dbUser || !dbUser.isActive) return fail("کاربر غیرفعال است", 403);
    const session: SessionUser = { ...raw, personId: dbUser.personId };
    if (requiredPermission) {
      const allowed = dbUser.role.permissions.some((p) => p.key === requiredPermission);
      if (!allowed) return fail("دسترسی غیرمجاز", 403);
    }
    return await handler(session);
  } catch (e) {
    if (e instanceof AuthError) return fail(e.message, e.status);
    console.error("API Error:", e);
    const msg = e instanceof Error ? e.message : "خطای سرور";
    return fail(msg, 500);
  }
}

export async function hasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: true } } },
  });
  if (!user) return false;
  return user.role.permissions.some((p) => p.key === permissionKey);
}

export async function audit(
  tenantId: string,
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>
) {
  await db.auditLog.create({
    data: { tenantId, userId, action, entity, entityId, meta: JSON.stringify(meta || {}) },
  });
}
