// ── موتور پورسانت پلکانی بازاریابان (بخش ۴.۷.۳ سند SOW) ──
// محاسبه پلکانی بر مبنای مبلغ قرارداد + پاداش ثابت
// الگوی پیش‌فرض: پلکان ۲٪ تا ۵٪ — تسویه: ۵۰٪ هنگام عقد قرارداد، ۵۰٪ متناسب وصول مطالبات از کارفرما

export interface CommissionTierInput {
  minAmount: number;
  maxAmount: number | null; // null = تا بی‌نهایت
  percent: number;
  label?: string;
}

export interface CommissionCalc {
  percent: number;
  tierLabel: string;
  totalAmount: number;
  signPart: number; // ۵۰٪ هنگام عقد
  collectionTarget: number; // ۵۰٪ باقی‌مانده
  formula: string;
}

export function findTierPercent(tiers: CommissionTierInput[], contractAmount: number): { percent: number; label: string } {
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  for (const t of sorted) {
    const maxOk = t.maxAmount === null || contractAmount <= t.maxAmount;
    const minOk = contractAmount >= t.minAmount;
    if (minOk && maxOk) return { percent: t.percent, label: t.label || "" };
  }
  return { percent: sorted.length ? sorted[sorted.length - 1].percent : 0, label: "پیش‌فرض" };
}

export function computeCommission(
  contractAmount: number,
  tiers: CommissionTierInput[],
  signSharePercent: number, // از تنظیمات (پیش‌فرض ۵۰)
  fixedBonus: number = 0 // پاداش ثابت
): CommissionCalc {
  const { percent, label } = findTierPercent(tiers, contractAmount);
  const base = (contractAmount * percent) / 100 + fixedBonus;
  const signPart = round((base * signSharePercent) / 100);
  const collectionTarget = round(base - signPart);
  return {
    percent,
    tierLabel: label,
    totalAmount: round(base),
    signPart,
    collectionTarget,
    formula: `(${fa(contractAmount)} × ${percent}٪)${fixedBonus ? ` + پاداش ${fa(fixedBonus)}` : ""} → تسویه ${signSharePercent}/${100 - signSharePercent}`,
  };
}

// سهم وصول: collectionPart × نسبت وصول مصالح/اقساط کارفرما
export function collectionShare(collectionTarget: number, collectedRatio: number): number {
  const r = Math.max(0, Math.min(1, collectedRatio));
  return round(collectionTarget * r);
}

function fa(n: number) {
  return n.toLocaleString("fa-IR");
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
