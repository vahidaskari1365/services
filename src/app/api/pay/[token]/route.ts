import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

// درگاه پرداخت عمومی (لینک پرداخت کارفرما) — بدون احراز هویت با توکن امن
type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const link = await db.paymentLink.findUnique({
    where: { token },
    include: { installment: { include: { contract: { include: { project: true } } } } },
  });
  if (!link) return NextResponse.json({ error: "لینک پرداخت نامعتبر است" }, { status: 404 });
  return NextResponse.json({
    link: {
      title: link.title,
      amount: link.amount,
      payerName: link.payerName,
      status: link.status,
      projectName: link.installment?.contract.project.name || "",
    },
  });
}

// شبیه‌سازی پرداخت موفق درگاه (شاپرک) + ثبت خودکار وصولی
export async function POST(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const link = await db.paymentLink.findUnique({ where: { token }, include: { installment: true } });
  if (!link) return NextResponse.json({ error: "لینک نامعتبر" }, { status: 404 });
  if (link.status !== "ACTIVE") return NextResponse.json({ error: "این لینک قبلاً استفاده یا لغو شده" }, { status: 400 });

  const gatewayRef = `SHAPARAK-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  await db.paymentLink.update({
    where: { id: link.id },
    data: { status: "PAID", paidAt: new Date(), gatewayRef },
  });

  const payment = await db.payment.create({
    data: {
      tenantId: link.tenantId,
      installmentId: link.installmentId,
      paymentLinkId: link.id,
      amount: link.amount,
      method: "GATEWAY",
      gatewayRef,
      note: "پرداخت آنلاین کارفرما",
    },
  });

  if (link.installment) {
    await db.contractInstallment.update({
      where: { id: link.installment.id },
      data: { status: "PAID", paidAt: new Date(), paymentId: payment.id },
    });
  }

  // اعلان به سیستم
  await db.notification.create({
    data: {
      tenantId: link.tenantId,
      channel: "IN_APP",
      title: "وصول خودکار قسط",
      body: `قسط ${link.amount.toLocaleString("fa-IR")} ریالی از طریق درگاه پرداخت وصول شد (کد پیگیری: ${gatewayRef})`,
      refType: "payment",
      refId: payment.id,
    },
  });

  return NextResponse.json({ ok: true, gatewayRef, amount: link.amount });
}
