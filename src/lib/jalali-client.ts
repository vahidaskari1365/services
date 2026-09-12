// تبدیل تاریخ شمسی به ISO سمت کلاینت — بدون وابستگی سروری
import { jalaliToGregorian } from "@/lib/jalali";

export function gregorianToIso(jy: number, jm: number, jd: number): string {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd, 12, 0, 0).toISOString();
}
