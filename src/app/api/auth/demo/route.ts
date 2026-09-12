import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createToken, SESSION_COOKIE } from "@/lib/auth";
import { DEFAULT_VIEW_BY_ROLE } from "@/lib/rbac";
import { audit } from "@/lib/api-helpers";
import { ensureSeeded } from "@/lib/seed";

/** ورود نمایشی بدون رمز — فقط انتخاب نقش (حالت دمو برای اشتراک‌گذاری لینک) */
export async function POST(req: NextRequest) {
  try {
    // اگر دیتابیس خالی باشد داده‌های دمو ساخته می‌شوند
    try {
      await ensureSeeded(db);
    } catch (seedErr) {
      console.error("ensureSeeded (demo) failed:", seedErr);
    }
    const { roleKey } = await req.json();
    if (!roleKey) {
      return NextResponse.json({ error: "نقش مشخص نشده است" }, { status: 400 });
    }
    const role = await db.role.findFirst({ where: { key: String(roleKey).toUpperCase() } });
    if (!role) {
      return NextResponse.json({ error: "نقش یافت نشد" }, { status: 404 });
    }
    const user = await db.user.findFirst({
      where: { roleId: role.id, isActive: true },
      include: { role: true, tenant: true },
    });
    if (!user) {
      return NextResponse.json({ error: "کاربری با این نقش یافت نشد" }, { status: 404 });
    }
    const token = createToken({
      userId: user.id,
      tenantId: user.tenantId,
      username: user.username,
      roleKey: user.role.key,
      roleName: user.role.name,
      personId: user.personId,
    });
    await audit(user.tenantId, user.id, "DEMO_LOGIN", "User", user.id);
    const roleWithPerms = await db.role.findUnique({
      where: { id: user.roleId },
      include: { permissions: { select: { key: true } } },
    });
    const res = NextResponse.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roleKey: user.role.key,
        roleName: user.role.name,
        tenantName: user.tenant.name,
        tenantId: user.tenantId,
        personId: user.personId,
        permissions: roleWithPerms?.permissions.map((p) => p.key) || [],
        defaultView: DEFAULT_VIEW_BY_ROLE[user.role.key] || "dashboard",
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error("demo login error", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
