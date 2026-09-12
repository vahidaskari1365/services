import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DEFAULT_VIEW_BY_ROLE } from "@/lib/rbac";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      role: { include: { permissions: true } },
      person: true,
      tenant: true,
    },
  });
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roleKey: user.role.key,
      roleName: user.role.name,
      tenantName: user.tenant.name,
      tenantId: user.tenantId,
      personId: user.personId,
      permissions: user.role.permissions.map((p) => p.key),
      defaultView: DEFAULT_VIEW_BY_ROLE[user.role.key] || "dashboard",
    },
  });
}
