// رندر پترن پیامک با متغیرها — الگوها از پنل تنظیمات خوانده می‌شوند (استاندارد پیامک خدماتی پترن‌دار)

import { db } from "@/lib/db";

export const SMS_TEMPLATE_SEEDS = [
  {
    key: "INSTALLMENT_REMINDER_1",
    label: "یادآوری اول قسط کارفرما",
    body: "{name} گرامی، قسط {amount} ریالی پروژه {project} سررسید شده است. جهت پرداخت آنلاین: {link}\nشرکت تأسیسات نمونه",
  },
  {
    key: "INSTALLMENT_REMINDER_2",
    label: "یادآوری دوم قسط",
    body: "{name} گرامی، یادآوری مجدد: قسط {amount} ریالی پروژه {project} همچنان پرداخت نشده است. {link}",
  },
  {
    key: "TASK_DUE",
    label: "یادآوری موعد وظیفه سرپرست",
    body: "{name}، وظیفه «{title}» در پروژه {project} تا تاریخ {date} سررسید می‌شود. لطفاً اقدام فرمایید.",
  },
  {
    key: "BALANCE_ALERT",
    label: "هشدار عدم ثبت تراز مصالح",
    body: "{name}، تراز مصالح قرارداد «{contract}» در پروژه {project} ثبت نشده و تسویه اکیپ مسدود است.",
  },
  {
    key: "CHECK_EXPIRY",
    label: "هشدار سررسید چک ضمانت اکیپ",
    body: "چک ضمانت {name} در تاریخ {date} سررسید می‌شود. لطفاً نسبت به تمدید اقدام شود.",
  },
];

export async function renderSmsTemplate(
  key: string,
  tenantId: string,
  vars: Record<string, string>
): Promise<string | null> {
  const tpl = await db.smsTemplate.findUnique({ where: { key } });
  if (!tpl || !tpl.enabled) return null;
  let body = tpl.body;
  for (const [k, v] of Object.entries(vars)) {
    body = body.replaceAll(`{${k}}`, v);
  }
  return body;
}
