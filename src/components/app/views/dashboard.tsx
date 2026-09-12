"use client";

import { useEffect, useState } from "react";
import { api, useApp } from "../store";
import { StatCard, CardBlock, LoadingCards, StatusBadge, Money, Jalali, EmptyState, SectionTitle } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, CircleDollarSign, FolderKanban, Siren, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { faMoneyShort, faNumber } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

interface DashboardData {
  kpis: {
    activeProjects: number; totalProjects: number; pendingApprovals: number;
    bottlenecks: number; overdueInstallments: number; overdueAmount: number;
    openEscalations: number; totalContractAmount: number; totalCollected: number;
    totalWages: number; totalCommissions: number; profit: number; collectionRate: number;
  };
  projects: {
    id: string; name: string; status: string; serviceLine: string; employer: string;
    supervisor: string; contractCount: number; contractAmount: number; taskCount: number;
    doneTasks: number; bottleneckCount: number; phaseProgress: number;
  }[];
  pendingApprovals: { id: string; title: string; type: string; amount: number | null; createdAt: string }[];
  bottleneckTasks: { id: string; title: string; project: string; assignee: string; dueDate: string; priority: string }[];
  collectionSeries: { month: string; amount: number }[];
  checkAlerts: { id: string; person: string; checkNumber: string; amount: number; dueDate: string; status: string; daysLeft: number }[];
  escalations: { id: string; title: string; severity: string; createdAt: string }[];
  notifications: { id: string; title: string; body: string; sentAt: string }[];
  smsLog: { id: string; title: string; body: string; sentAt: string; status: string }[];
}

const PIE_COLORS = ["#059669", "#d97706", "#e11d48", "#0891b2", "#7c3aed"];

export default function DashboardView() {
  const setView = useApp((s) => s.setView);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <EmptyState title="خطا در بارگذاری داشبورد" desc={error} />;
  if (!data) return <LoadingCards count={8} />;

  const k = data.kpis;
  const pieData = [
    { name: "وصول شده", value: k.totalCollected },
    { name: "مطالبات معوق", value: k.overdueAmount },
    { name: "دستمزد کارکرد", value: k.totalWages },
    { name: "پورسانت", value: k.totalCommissions },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="داشبورد و هوش تجاری"
        desc="نمای کلی وضعیت پروژه‌ها، وصول مطالبات، گلوگاه‌ها و شاخص‌های سود و زیان — به‌روزرسانی خودکار توسط موتور پیگیری"
      />

      {/* KPI ها */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="پروژه‌های فعال" value={faNumber(k.activeProjects)} sub={`از ${faNumber(k.totalProjects)} پروژه`} icon={<FolderKanban className="w-5 h-5" />} tone="primary" />
        <StatCard title="تأییدیه‌های در انتظار" value={faNumber(k.pendingApprovals)} icon={<CheckCircle2 className="w-5 h-5" />} tone="warning" />
        <StatCard title="گلوگاه‌های بحرانی" value={faNumber(k.bottlenecks)} icon={<Siren className="w-5 h-5" />} tone="danger" />
        <StatCard title="اقساط معوق" value={faMoneyShort(k.overdueAmount)} sub={`${faNumber(k.overdueInstallments)} قسط`} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" />
      </div>

      {/* شاخص مالی */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="مجموع قراردادها" value={faMoneyShort(k.totalContractAmount)} icon={<ArrowLeftRight className="w-5 h-5" />} />
        <StatCard title="مجموع وصولی" value={faMoneyShort(k.totalCollected)} sub={`نرخ وصول ${faNumber(k.collectionRate)}٪`} icon={<CircleDollarSign className="w-5 h-5" />} tone="success" />
        <StatCard title="دستمزد کارکرد تأییدشده" value={faMoneyShort(k.totalWages)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard
          title="سود و زیان تجمعی"
          value={faMoneyShort(k.profit)}
          icon={<TrendingUp className="w-5 h-5" />}
          tone={k.profit >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* نمودار وصول مطالبات */}
        <CardBlock title="نمودار وصول مطالبات (۶ ماه اخیر)">
          <div className="h-56" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.collectionSeries} margin={{ top: 8, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} width={38} />
                <Tooltip
                  formatter={(v: number) => [`${faMoneyShort(v)} ریال`, "وصولی"]}
                  contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }}
                />
                <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBlock>

        {/* ترکیب مالی */}
        <CardBlock title="ترکیب مالی سیستم">
          {pieData.length === 0 ? (
            <EmptyState title="داده مالی موجود نیست" />
          ) : (
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, n: string) => [faMoneyShort(v), n]}
                    contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-2 -mt-8">
                {pieData.map((d, i) => (
                  <span key={d.name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardBlock>

        {/* هشدارهای چک ضمانت */}
        <CardBlock title="هشدارهای چک ضمانت اکیپ‌ها">
          {data.checkAlerts.length === 0 ? (
            <EmptyState title="چکی در آستانه سررسید نیست" />
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pl-1">
              {data.checkAlerts.map((c) => (
                <div key={c.id} className={`rounded-xl border p-2.5 ${c.daysLeft < 0 ? "border-rose-200 bg-rose-50" : c.daysLeft <= 15 ? "border-amber-200 bg-amber-50" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{c.person}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    چک {c.checkNumber} — {faMoneyShort(c.amount)} ریال — سررسید <Jalali date={c.dueDate} />
                  </p>
                  <p className={`text-[11px] font-medium mt-0.5 ${c.daysLeft < 0 ? "text-rose-600" : "text-amber-600"}`}>
                    {c.daysLeft < 0 ? `${faNumber(-c.daysLeft)} روز از سررسید گذشته — ارجاع پروژه جدید قفل شد` : `${faNumber(c.daysLeft)} روز تا سررسید`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBlock>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* رادار گلوگاه‌ها */}
        <CardBlock
          title="رادار گلوگاه‌های پروژه‌ای"
          headerAction={
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setView("action")}>
              مشاهده مرکز عملیات
            </Button>
          }
        >
          {data.bottleneckTasks.length === 0 ? (
            <EmptyState title="گلوگاه فعالی وجود ندارد" desc="همه وظایف در محدوده موعد خود هستند" />
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
              {data.bottleneckTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t.project} — مسئول: {t.assignee}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <StatusBadge status={t.priority} />
                    <p className="text-[10px] text-rose-600 mt-1"><Jalali date={t.dueDate} /></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBlock>

        {/* وضعیت پروژه‌ها */}
        <CardBlock
          title="وضعیت پروژه‌ها"
          headerAction={
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setView("projects")}>
              مدیریت پروژه‌ها
            </Button>
          }
        >
          <div className="space-y-2.5 max-h-64 overflow-y-auto pl-1">
            {data.projects.map((p) => (
              <div key={p.id} className="rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{p.name}</p>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{p.serviceLine}</Badge>
                  <span>{faNumber(p.contractCount)} قرارداد ({faMoneyShort(p.contractAmount)})</span>
                  <span>کارها: {faNumber(p.doneTasks)}/{faNumber(p.taskCount)}</span>
                  {p.bottleneckCount > 0 && <span className="text-rose-600 font-medium">گلوگاه: {faNumber(p.bottleneckCount)}</span>}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${p.phaseProgress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardBlock>
      </div>

      {/* آخرین پیامک‌ها */}
      {data.smsLog.length > 0 && (
        <CardBlock title="آخرین پیامک‌های ارسالی (پترن‌دار — شبیه‌سازی)">
          <div className="space-y-2 max-h-56 overflow-y-auto pl-1">
            {data.smsLog.map((s) => (
              <div key={s.id} className="rounded-xl border border-dashed p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{s.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {s.status === "SIMULATED" ? "شبیه‌سازی‌شده" : s.status}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-5 whitespace-pre-line">{s.body}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{formatJalali(s.sentAt, true)}</p>
              </div>
            ))}
          </div>
        </CardBlock>
      )}
    </div>
  );
}
