// دریافت فایل (دانلود/پیش‌نمایش)، ویرایش اطلاعات و حذف سند
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit, fail } from "@/lib/api-helpers";

// GET /api/documents/[id]?mode=inline|download
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    const { id } = await ctx.params;
    const doc = await db.documentFile.findFirst({ where: { id, tenantId: session.tenantId } });
    if (!doc) return fail("سند یافت نشد", 404);

    const bytes = Buffer.from(doc.data || "", "base64");
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") === "inline" ? "inline" : "attachment";
    // RFC 5987 — نام فایل فارسی در هدر Content-Disposition
    const encoded = encodeURIComponent(`${doc.title}${getExtension(doc.fileName, doc.mimeType)}`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${mode}; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  }, "documents.view");
}

function getExtension(fileName: string, mime: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot > 0) return fileName.slice(dot);
  const MAP: Record<string, string> = { "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };
  return MAP[mime] || "";
}

// ویرایش عنوان/دسته/یادداشت
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    const { id } = await ctx.params;
    const doc = await db.documentFile.findFirst({ where: { id, tenantId: session.tenantId } });
    if (!doc) return fail("سند یافت نشد", 404);
    const body = await req.json().catch(() => null);
    if (!body) return fail("داده نامعتبر است");

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (t.length < 2) return fail("عنوان باید حداقل ۲ نویسه باشد");
      data.title = t;
    }
    if (body.category !== undefined) data.category = String(body.category);
    if (body.notes !== undefined) data.notes = String(body.notes);
    if (Object.keys(data).length === 0) return fail("تغییری ارسال نشده است");

    await db.documentFile.update({ where: { id: doc.id }, data });
    await audit(session.tenantId, session.userId, "UPDATE", "DocumentFile", doc.id, { fields: Object.keys(data) });
    return NextResponse.json({ ok: true });
  }, "documents.manage");
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (session) => {
    const { id } = await ctx.params;
    const doc = await db.documentFile.findFirst({ where: { id, tenantId: session.tenantId } });
    if (!doc) return fail("سند یافت نشد", 404);
    await db.documentFile.delete({ where: { id: doc.id } });
    await audit(session.tenantId, session.userId, "DELETE", "DocumentFile", doc.id, { title: doc.title });
    return NextResponse.json({ ok: true });
  }, "documents.manage");
}
