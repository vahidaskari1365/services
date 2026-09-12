import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit } from "@/lib/api-helpers";

// وظایف — نمای سرپرست (موبایل) و همه وظایف برای مدیر/منشی
export async function GET(req: NextRequest) {
  return withAuth(async (session) => {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    let where: Record<string, unknown> = { tenantId: session.tenantId };
    if (scope === "own" && session.personId) {
      where = { tenantId: session.tenantId, assigneePersonId: session.personId };
    }
    const tasks = await db.task.findMany({
      where,
      include: { project: { include: { serviceLine: true } }, assigneePerson: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });
    return NextResponse.json({ tasks });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(
    async (session) => {
      const body = await req.json();
      const task = await db.task.create({
        data: {
          tenantId: session.tenantId,
          projectId: body.projectId,
          contractId: body.contractId || null,
          assigneePersonId: body.assigneePersonId || null,
          title: body.title,
          description: body.description || "",
          dueDate: new Date(body.dueDate),
          priority: body.priority || "NORMAL",
        },
      });
      await audit(session.tenantId, session.userId, "CREATE", "Task", task.id, { title: task.title });
      return NextResponse.json({ task });
    },
    "tasks.manage"
  );
}
