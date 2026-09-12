// قالب‌بندی اعداد و مبالغ به فارسی

export function faNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const s = n.toLocaleString("fa-IR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  // برای اعداد منفی، علامت منفی در متن RTL جابه‌جا می‌شود؛ با LRM (U+200E) سمت درست حفظ می‌شود
  return n < 0 ? `\u200E${s}` : s;
}

export function faMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${faNumber(Math.round(n))} ریال`;
}

export function faMoneyShort(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${faNumber(n / 1_000_000_000, 1)} میلیارد`;
  if (abs >= 1_000_000) return `${faNumber(n / 1_000_000, 1)} میلیون`;
  if (abs >= 1_000) return `${faNumber(n / 1_000, 0)} هزار`;
  return faNumber(n);
}

export function faPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${faNumber(n, 1)}٪`;
}
