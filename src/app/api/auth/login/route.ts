import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createToken, SESSION_COOKIE } from "@/lib/auth";
import { DEFAULT_VIEW_BY_ROLE } from "@/lib/rbac";
import { audit } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "نام کاربری و رمز عبور الزامی است" }, { status: 400 });
    }
    const user = await db.user.findUnique({
      where: { username: String(username).trim().toLowerCase() },
      include: { role: true, tenant: true },
    });
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
    }
    const token = createToken({
      userId: user.id,
      tenantId: user.tenantId,
      username: user.username,
      roleKey: user.role.key,
      roleName: user.role.name,
      personId: user.personId,
    });
    await audit(user.tenantId, user.id, "LOGIN", "User", user.id);
    const roleWithPerms = await db.role.findUnique({
      where: { id: user.roleId },
      include: { permissions: { select: { key: true } } },
    });
    const res = NextResponse.json({
      ok: true,
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
    console.error("login error", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
