// ── سد سخت تراز مصالح — Hard Gate (بخش ۴.۷.۱ سند SOW) ──
// در قراردادهای «بامصالح»، پیش از تأیید تسویه اکیپ، سرپرست ملزم به ثبت تراز مصالح است.
// کسری غیرمجاز به صورت خودکار از دستمزد اکیپ کسر می‌شود. این سد قابل دور زدن نیست.

import { db } from "@/lib/db";

export interface HardGateResult {
  passed: boolean; // آیا تسویه مجاز است
  contractType: "WAGE" | "WITH_MATERIALS";
  missingItems: { id: string; name: string; phaseTitle?: string }[]; // آیتم‌های بدون تراز ثبت‌شده
  totalShortage: number; // مبلغ کل کسری (به ارزش ریالی)
  shortageLines: { itemName: string; qty: number; unitPrice: number; deduction: number }[];
  wageTotal: number; // مجموع دستمزد تأییدشده اکیپ
  netPayable: number; // دستمزد − کسری
  message: string;
}

export async function evaluateHardGate(contractId: string): Promise<HardGateResult> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: {
      materialItems: true,
      balances: { include: { materialItem: true, phase: true } },
      workLogs: { where: { status: "APPROVED" } },
    },
  });

  if (!contract) {
    return {
      passed: false, contractType: "WAGE", missingItems: [], totalShortage: 0,
      shortageLines: [], wageTotal: 0, netPayable: 0, message: "قرارداد یافت نشد",
    };
  }

  const wageTotal = contract.workLogs.reduce((s, w) => s + (w.computedAmount || 0), 0);

  // قرارداد دستمزدی: سد مصالح ندارد
  if (contract.type === "WAGE") {
    return {
      passed: true, contractType: "WAGE", missingItems: [], totalShortage: 0,
      shortageLines: [], wageTotal, netPayable: wageTotal,
      message: "قرارداد دستمزدی؛ نیازی به تراز مصالح نیست",
    };
  }

  // قرارداد بامصالح: هر آیتم مصالح باید برای هر مرحله‌ای که مصرف داشته تراز ثبت شود
  // معیار سد: برای هر (آیتم مصالح × مرحله فعال پروژه) ترازی ثبت شده باشد یا آیتم اصلاً برنامه‌ریزی نشده باشد
  const phases = await db.phase.findMany({ where: { projectId: contract.projectId }, orderBy: { order: "asc" } });
  const balanceKeys = new Set(contract.balances.map((b) => `${b.materialItemId}__${b.phaseId}`));

  const missingItems: HardGateResult["missingItems"] = [];
  for (const item of contract.materialItems) {
    for (const phase of phases) {
      if (!balanceKeys.has(`${item.id}__${phase.id}`)) {
        missingItems.push({ id: item.id, name: `${item.name} — مرحله «${phase.title}»` });
      }
    }
  }

  // محاسبه کسری: هر تراز ثبت‌شده با کسری > ۰ → کسر به ارزش واحد مصالح
  const shortageLines = contract.balances
    .filter((b) => b.shortageQty > 0)
    .map((b) => ({
      itemName: b.materialItem.name,
      qty: b.shortageQty,
      unitPrice: b.materialItem.unitPrice,
      deduction: Math.round(b.shortageQty * b.materialItem.unitPrice),
    }));
  const totalShortage = shortageLines.reduce((s, l) => s + l.deduction, 0);
  const netPayable = Math.max(0, wageTotal - totalShortage);

  const passed = missingItems.length === 0;
  return {
    passed,
    contractType: "WITH_MATERIALS",
    missingItems,
    totalShortage,
    shortageLines,
    wageTotal,
    netPayable,
    message: passed
      ? totalShortage > 0
        ? `تراز ثبت شده؛ کسری ${totalShortage.toLocaleString("fa-IR")} ریال از دستمزد کسر می‌شود`
        : "تراز مصالح کامل است؛ تسویه مجاز است"
      : `تا ثبت تراز مصالح برای ${missingItems.length} قلم، دکمه تسویه قفل است (سد سخت قابل دور زدن نیست)`,
  };
}

// محاسبه نسبت وصول مصالح برای پورسانت بازاریاب
export async function materialCollectionRatio(contractId: string): Promise<number> {
  const items = await db.materialItem.findMany({ where: { contractId } });
  const receipts = await db.materialReceipt.findMany({ where: { contractId } });
  const planned = items.reduce((s, i) => s + i.plannedQty * i.unitPrice, 0);
  const received = items.reduce((s, i) => {
    const got = receipts.filter((r) => r.materialItemId === i.id).reduce((a, r) => a + r.qty, 0);
    return s + Math.min(got, i.plannedQty) * i.unitPrice;
  }, 0);
  return planned > 0 ? received / planned : 1;
}
