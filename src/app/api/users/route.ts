// مدیریت کاربران — لیست کاربران و ایجاد کاربر جدید (مجوز: users.manage)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit, fail } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  return withAuth(async (session) => {
    const users = await db.user.findMany({
      where: { tenantId: session.tenantId },
      include: {
        role: { select: { key: true, name: true } },
        person: { select: { id: true, fullName: true, type: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const roles = await db.role.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, key: true, name: true, description: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        isActive: u.isActive,
        createdAt: u.createdAt,
        roleId: u.roleId,
        roleKey: u.role.key,
        roleName: u.role.name,
        personId: u.personId,
        personName: u.person?.fullName || null,
      })),
      roles,
    });
  }, "users.manage");
}

export async function POST(req: NextRequest) {
  return withAuth(async (session) => {
    const body = await req.json().catch(() => null);
    if (!body) return fail("داده نامعتبر است");
    const username = String(body.username || "").trim().toLowerCase();
    const fullName = String(body.fullName || "").trim();
    const password = String(body.password || "");
    const roleId = String(body.roleId || "");
    const personId = body.personId ? String(body.personId) : null;

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) {
      return fail("نام کاربری باید ۳ تا ۳۲ نویسه انگلیسی، عدد، نقطه یا خط تیره باشد");
    }
    if (fullName.length < 3) return fail("نام کامل را وارد کنید");
    if (password.length < 6) return fail("رمز عبور باید حداقل ۶ نویسه باشد");
    if (!roleId) return fail("انتخاب نقش الزامی است");

    const role = await db.role.findFirst({ where: { id: roleId, tenantId: session.tenantId } });
    if (!role) return fail("نقش یافت نشد");

    const dup = await db.user.findUnique({ where: { username } });
    if (dup) return fail("این نام کاربری قبلاً استفاده شده است");

    if (personId) {
      const person = await db.person.findFirst({ where: { id: personId, tenantId: session.tenantId } });
      if (!person) return fail("شخص انتخاب‌شده یافت نشد");
      const linked = await db.user.findUnique({ where: { personId } });
      if (linked) return fail("این شخص قبلاً به کاربر دیگری متصل شده است");
    }

    const user = await db.user.create({
      data: {
        tenantId: session.tenantId,
        username,
        fullName,
        passwordHash: hashPassword(password),
        roleId,
        personId,
        isActive: true,
      },
      include: { role: { select: { key: true, name: true } } },
    });
    await audit(session.tenantId, session.userId, "CREATE", "User", user.id, { username, roleKey: role.key });
    return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, roleName: user.role.name } });
  }, "users.manage");
}
