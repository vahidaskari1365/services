"use client";

import { faMoneyShort, faNumber } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  title, value, sub, icon, tone = "default",
}: {
  title: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "primary";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-foreground",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-rose-50 text-rose-700 border-rose-100",
    primary: "bg-emerald-600 text-white border-emerald-600",
  };
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold truncate">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          {icon && (
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${tones[tone]}`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "فعال", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  PAUSED: { label: "متوقف موقت", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  STOPPED: { label: "متوقف شده", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  DONE: { label: "خاتمه یافته", cls: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  PENDING: { label: "در انتظار", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  APPROVED: { label: "تأیید شده", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  REJECTED: { label: "رد شده", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  PAID: { label: "پرداخت شده", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  TODO: { label: "انجام نشده", cls: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  IN_PROGRESS: { label: "در جریان", cls: "bg-sky-100 text-sky-800 hover:bg-sky-100" },
  BLOCKED: { label: "مسدود", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  CRITICAL: { label: "بحرانی", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  HIGH: { label: "مهم", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  NORMAL: { label: "عادی", cls: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  REQUESTED: { label: "درخواست شده", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  PENDING_APPROVAL: { label: "در انتظار تأیید مدیر", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  SETTLED: { label: "تسویه شده", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  PARTIAL: { label: "پرداخت جزئی", cls: "bg-sky-100 text-sky-800 hover:bg-sky-100" },
  OPEN: { label: "باز", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  VALID: { label: "معتبر", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  EXPIRING_SOON: { label: "نزدیک سررسید", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  EXPIRED: { label: "منقضی", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  WAGE: { label: "دستمزدی", cls: "bg-violet-100 text-violet-800 hover:bg-violet-100" },
  WITH_MATERIALS: { label: "بامصالح", cls: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
  DRAFT: { label: "پیش‌نویس", cls: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  TERMINATED: { label: "فسخ شده", cls: "bg-rose-100 text-rose-800 hover:bg-rose-100" },
  ACTIVE_LINK: { label: "فعال", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  CANCELLED: { label: "لغو شده", cls: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  GATEWAY: { label: "درگاه", cls: "bg-sky-100 text-sky-800 hover:bg-sky-100" },
  CASH: { label: "نقدی", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  TRANSFER: { label: "کارت به کارت", cls: "bg-violet-100 text-violet-800 hover:bg-violet-100" },
  EMPLOYER: { label: "کارفرما", cls: "bg-sky-100 text-sky-800 hover:bg-sky-100" },
  TEAM_LEADER: { label: "سرپرست اکیپ", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  MARKETER: { label: "بازاریاب", cls: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  SUPERVISOR: { label: "ناظر/سرپرست", cls: "bg-violet-100 text-violet-800 hover:bg-violet-100" },
  OTHER: { label: "سایر", cls: "bg-slate-100 text-slate-700 hover:bg-slate-100" },
  FIXED: { label: "مقطوع", cls: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  METERED: { label: "متراژی", cls: "bg-sky-100 text-sky-800 hover:bg-sky-100" },
  BASE_PLUS_EXTRA: { label: "پایه + مازاد", cls: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
  TEAM: { label: "اکیپ", cls: "bg-teal-100 text-teal-800 hover:bg-teal-100" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { label: status, cls: "bg-slate-100 text-slate-700" };
  return <Badge className={`${s.cls} border-0 text-[11px] font-medium`}>{s.label}</Badge>;
}

export function Money({ value, short = true }: { value: number | null | undefined; short?: boolean }) {
  if (value === null || value === undefined) return <span>—</span>;
  return <span>{short ? faMoneyShort(value) : faNumber(value)}</span>;
}

export function Jalali({ date, withTime }: { date: string | Date | null | undefined; withTime?: boolean }) {
  return <span>{formatJalali(date, withTime)}</span>;
}

export function DueInfo({ date }: { date: string | Date | null | undefined }) {
  if (!date) return <span>—</span>;
  const d = typeof date === "string" ? new Date(date) : date;
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-medium">
        <XCircle className="w-3.5 h-3.5" /> {faNumber(-days)} روز تأخیر
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
        <Clock className="w-3.5 h-3.5" /> {faNumber(days)} روز مانده
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> {formatJalali(d)}
    </span>
  );
}

export function SectionTitle({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {desc && <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-10 h-10 text-muted-foreground/40 mb-3" />
      <p className="font-medium text-muted-foreground">{title}</p>
      {desc && <p className="text-sm text-muted-foreground/70 mt-1">{desc}</p>}
    </div>
  );
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="py-4">
          <CardContent className="px-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CardBlock({ title, children, headerAction }: { title: string; children: ReactNode; headerAction?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}
