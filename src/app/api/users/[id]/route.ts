// ویرایش کاربر — تغییر نام، نقش، فعال/غیرفعال، بازنشانی رمز (مجوز: users.manage)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit, fail } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/auth";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body) return fail("داده نامعتبر است");

    const user = await db.user.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { role: true },
    });
    if (!user) return fail("کاربر یافت نشد", 404);

    const data: Record<string, unknown> = {};

    // تغییر نام کامل
    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim();
      if (fullName.length < 3) return fail("نام کامل باید حداقل ۳ نویسه باشد");
      data.fullName = fullName;
    }

    // تغییر نقش
    if (body.roleId !== undefined && body.roleId !== user.roleId) {
      const role = await db.role.findFirst({ where: { id: String(body.roleId), tenantId: session.tenantId } });
      if (!role) return fail("نقش یافت نشد");
      // اگر آخرین مدیر فعال است، نقشش را عوض نکن
      if (user.role.key === "MANAGER" && user.isActive && role.key !== "MANAGER") {
        const activeManagers = await db.user.count({
          where: { tenantId: session.tenantId, isActive: true, role: { key: "MANAGER" }, id: { not: user.id } },
        });
        if (activeManagers === 0) return fail("حداقل یک مدیر فعال باید باقی بماند");
      }
      data.roleId = role.id;
    }

    // فعال/غیرفعال‌سازی
    if (body.isActive !== undefined && body.isActive !== user.isActive) {
      if (user.id === session.userId) return fail("نمی‌توانید حساب خودتان را غیرفعال کنید");
      if (user.isActive && user.role.key === "MANAGER") {
        const activeManagers = await db.user.count({
          where: { tenantId: session.tenantId, isActive: true, role: { key: "MANAGER" }, id: { not: user.id } },
        });
        if (activeManagers === 0) return fail("حداقل یک مدیر فعال باید باقی بماند");
      }
      data.isActive = Boolean(body.isActive);
    }

    // بازنشانی رمز عبور
    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length < 6) return fail("رمز عبور باید حداقل ۶ نویسه باشد");
      data.passwordHash = hashPassword(password);
    }

    if (Object.keys(data).length === 0) return fail("تغییری ارسال نشده است");

    await db.user.update({ where: { id: user.id }, data });
    await audit(session.tenantId, session.userId, "UPDATE", "User", user.id, {
      fields: Object.keys(data).filter((k) => k !== "passwordHash"),
    });
    return NextResponse.json({ ok: true });
  }, "users.manage");
}
