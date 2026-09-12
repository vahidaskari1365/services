// ── موتور تعرفه سرپرستان (بخش ۴.۷.۲ سند SOW) ──
// سه الگوی تعرفه: مقطوع / متراژی / پایه + واحد اضافه
// هیچ فرمولی در کد سفت و سخت نشده؛ ورودی‌ها از رکورد کارکرد و تنظیمات می‌آیند

export type TariffType = "FIXED" | "METERED" | "BASE_PLUS_EXTRA";

export interface TariffInput {
  tariffType: TariffType;
  baseAmount?: number; // مقطوع: مبلغ ثابت هر خدمت | BASE_PLUS_EXTRA: مبلغ پایه
  rate?: number; // متراژی: نرخ واحد
  quantity?: number; // متراژی: متراژ
  extraUnits?: number; // واحدهای مازاد
  extraRate?: number; // نرخ هر واحد مازاد
}

export interface TariffResult {
  amount: number;
  formula: string; // توضیح فرمول اعمال‌شده برای شفافیت
}

export function computeTariff(input: TariffInput): TariffResult {
  switch (input.tariffType) {
    case "FIXED": {
      const amount = round(input.baseAmount || 0);
      return { amount, formula: "مقطوع: مبلغ ثابت خدمت" };
    }
    case "METERED": {
      const amount = round((input.rate || 0) * (input.quantity || 0));
      return {
        amount,
        formula: `متراژی: ${fa(input.rate)} × ${fa(input.quantity)}`,
      };
    }
    case "BASE_PLUS_EXTRA": {
      const amount = round((input.baseAmount || 0) + (input.extraUnits || 0) * (input.extraRate || 0));
      return {
        amount,
        formula: `پایه + مازاد: ${fa(input.baseAmount)} + (${fa(input.extraUnits)} × ${fa(input.extraRate)})`,
      };
    }
    default:
      return { amount: 0, formula: "نامشخص" };
  }
}

function fa(n?: number) {
  return (n ?? 0).toLocaleString("fa-IR");
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}

// آیتم‌های مستقل کیف پول سرپرست: تنخواه، ایاب و ذهاب، بازدید مازاد
export const EXPENSE_ITEM_KINDS = [
  { key: "PETTY_CASH", name: "تنخواه" },
  { key: "TRAVEL", name: "ایاب و ذهاب" },
  { key: "EXTRA_VISIT", name: "بازدید مازاد" },
  { key: "INVOICE", name: "فاکتور" },
] as const;
