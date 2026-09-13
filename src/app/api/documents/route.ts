// آرشیو اسناد — فهرست اسناد و بارگذاری فایل جدید
// فایل‌ها base64 در دیتابیس ذخیره می‌شوند (سازگار با SQLite دمو و Postgres)
// مجوز مشاهده: documents.view — مجوز بارگذاری: documents.manage
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, audit, fail } from "@/lib/api-helpers";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // ۵ مگابایت

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
};

export async function GET(req: NextRequest) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";
    const projectId = searchParams.get("projectId") || "";
    const q = (searchParams.get("q") || "").trim();

    const docs = await db.documentFile.findMany({
      where: {
        tenantId: session.tenantId,
        ...(category ? { category } : {}),
        ...(projectId ? { projectId } : {}),
        ...(q ? { OR: [{ title: { contains: q } }, { fileName: { contains: q } }, { notes: { contains: q } }] } : {}),
      },
      select: {
        id: true, title: true, fileName: true, mimeType: true, size: true,
        category: true, notes: true, createdAt: true,
        project: { select: { id: true, name: true } },
        contract: { select: { id: true, title: true } },
        uploader: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return NextResponse.json({ documents: docs });
  }, "documents.view");
}

export async function POST(req: NextRequest) {
  return withAuth(async (session) => {
    const form = await req.formData().catch(() => null);
    if (!form) return fail("داده فرم نامعتبر است");
    const file = form.get("file");
    if (!(file instanceof File)) return fail("فایلی انتخاب نشده است");
    if (file.size === 0) return fail("فایل خالی است");
    if (file.size > MAX_FILE_SIZE) return fail("حجم فایل باید کمتر از ۵ مگابایت باشد");

    const title = String(form.get("title") || "").trim() || file.name;
    const category = String(form.get("category") || "OTHER");
    const notes = String(form.get("notes") || "").trim();
    const projectId = String(form.get("projectId") || "") || null;
    const contractId = String(form.get("contractId") || "") || null;
    const personId = String(form.get("personId") || "") || null;

    if (projectId) {
      const p = await db.project.findFirst({ where: { id: projectId, tenantId: session.tenantId } });
      if (!p) return fail("پروژه انتخاب‌شده یافت نشد");
    }
    if (contractId) {
      const c = await db.contract.findFirst({ where: { id: contractId, tenantId: session.tenantId } });
      if (!c) return fail("قرارداد انتخاب‌شده یافت نشد");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await db.documentFile.create({
      data: {
        tenantId: session.tenantId,
        title,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        category,
        notes,
        projectId,
        contractId,
        personId,
        data: buffer.toString("base64"),
        uploadedById: session.userId,
      },
      select: { id: true, title: true, fileName: true, mimeType: true, size: true, category: true },
    });
    await audit(session.tenantId, session.userId, "UPLOAD", "DocumentFile", doc.id, { title, category, size: file.size });
    return NextResponse.json({ ok: true, document: doc });
  }, "documents.manage");
}
