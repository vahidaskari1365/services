"use client";

import { useEffect, useState } from "react";
import { api } from "../store";
import { CardBlock, EmptyState, SectionTitle, LoadingCards } from "../shared";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { faMoneyShort, faNumber, faPercent } from "@/lib/format";
import { TrendingDown, TrendingUp } from "lucide-react";
import ExportButtons from "../export-buttons";

interface PnlRow { projectId: string; project: string; serviceLine: string; revenue: number; wages: number; commission: number; profit: number; margin: number }
interface LineRow { line: string; revenue: number; wages: number; commission: number; profit: number }
interface MarketerRow { marketer: string; total: number; paid: number; contracts: number }
interface PnlData {
  byProject: PnlRow[];
  byLine: LineRow[];
  byMarketer: MarketerRow[];
  totals: { revenue: number; wages: number; commission: number; profit: number; payoutsCount: number };
}

export default function ReportsView() {
  const [data, setData] = useState<PnlData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<PnlData>("/api/reports/pnl").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <EmptyState title="خطا در گزارش" desc={error} />;
  if (!data) return <LoadingCards count={6} />;

  const t = data.totals;
  const chartData = data.byProject.map((r) => ({
    name: r.project.length > 14 ? r.project.slice(0, 14) + "…" : r.project,
    درآمد: r.revenue,
    دستمزد: r.wages,
    پورسانت: r.commission,
    سود: r.profit,
  }));

  const exportCols = [
    { key: "project", label: "پروژه", type: "text" as const },
    { key: "serviceLine", label: "رسته کاری", type: "text" as const },
    { key: "revenue", label: "درآمد (ریال)", type: "money" as const },
    { key: "wages", label: "دستمزد (ریال)", type: "money" as const },
    { key: "commission", label: "پورسانت (ریال)", type: "money" as const },
    { key: "profit", label: "سود (ریال)", type: "money" as const },
    { key: "margin", label: "حاشیه سود (٪)", type: "number" as const },
  ];
  const exportRows = data.byProject.map((r) => ({
    project: r.project,
    serviceLine: r.serviceLine,
    revenue: r.revenue,
    wages: r.wages,
    commission: r.commission,
    profit: r.profit,
    margin: r.margin,
  }));

  return (
    <div className="space-y-5">
      <SectionTitle
        title="گزارش تحلیلی سود و زیان"
        desc="به تفکیک پروژه، رسته کاری و بازاریاب — خروجی استاندارد برای حسابداری"
        action={
          <ExportButtons
            title="سود و زیان به تفکیک پروژه"
            subtitle="خروجی استاندارد حسابداری — مبالغ به ریال"
            cols={exportCols}
            rows={exportRows}
            fileName="pnl-report"
          />
        }
      />

      {/* جمع کل */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">درآمد (وصولی)</p>
          <p className="text-lg font-extrabold mt-1 text-emerald-700">{faMoneyShort(t.revenue)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">دستمزد کارکرد</p>
          <p className="text-lg font-extrabold mt-1">{faMoneyShort(t.wages)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">پورسانت پرداختی</p>
          <p className="text-lg font-extrabold mt-1">{faMoneyShort(t.commission)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${t.profit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
          <p className="text-xs text-muted-foreground">سود خالص</p>
          <p className={`text-lg font-extrabold mt-1 flex items-center gap-1 ${t.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {t.profit >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {faMoneyShort(t.profit)}
          </p>
        </div>
      </div>

      {/* نمودار مقایسه‌ای پروژه‌ها */}
      <CardBlock title="مقایسه پروژه‌ها">
        {chartData.length === 0 ? (
          <EmptyState title="داده‌ای موجود نیست" />
        ) : (
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} width={40} />
                <Tooltip
                  formatter={(v: number, n: string) => [`${faMoneyShort(v)} ریال`, n]}
                  contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }}
                />
                <Legend wrapperStyle={{ fontFamily: "Vazirmatn", fontSize: 11, direction: "rtl" }} />
                <Bar dataKey="درآمد" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="دستمزد" fill="#d97706" radius={[4, 4, 0, 0]} />
                <Bar dataKey="پورسانت" fill="#0891b2" radius={[4, 4, 0, 0]} />
                <Bar dataKey="سود" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBlock>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* جدول به تفکیک پروژه */}
        <CardBlock title="به تفکیک پروژه">
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-right py-2 px-2 font-medium">پروژه</th>
                  <th className="text-right py-2 px-2 font-medium">درآمد</th>
                  <th className="text-right py-2 px-2 font-medium">سود</th>
                  <th className="text-right py-2 px-2 font-medium">حاشیه</th>
                </tr>
              </thead>
              <tbody>
                {data.byProject.map((r) => (
                  <tr key={r.projectId} className="border-b last:border-0">
                    <td className="py-2 px-2">
                      <p className="font-medium">{r.project}</p>
                      <p className="text-[10px] text-muted-foreground">{r.serviceLine}</p>
                    </td>
                    <td className="py-2 px-2">{faMoneyShort(r.revenue)}</td>
                    <td className={`py-2 px-2 font-medium ${r.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{faMoneyShort(r.profit)}</td>
                    <td className="py-2 px-2">{faPercent(r.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBlock>

        <div className="space-y-4">
          {/* به تفکیک رسته */}
          <CardBlock title="به تفکیک رسته کاری">
            <div className="space-y-2">
              {data.byLine.map((l) => (
                <div key={l.line} className="flex items-center justify-between rounded-xl border p-2.5">
                  <p className="text-xs font-medium">{l.line}</p>
                  <div className="text-left text-[11px]">
                    <p>درآمد: {faMoneyShort(l.revenue)}</p>
                    <p className={l.profit >= 0 ? "text-emerald-700" : "text-rose-700"}>سود: {faMoneyShort(l.profit)}</p>
                  </div>
                </div>
              ))}
              {data.byLine.length === 0 && <p className="text-xs text-muted-foreground">داده‌ای موجود نیست</p>}
            </div>
          </CardBlock>

          {/* به تفکیک بازاریاب */}
          <CardBlock title="به تفکیک بازاریاب">
            <div className="space-y-2">
              {data.byMarketer.map((m) => (
                <div key={m.marketer} className="flex items-center justify-between rounded-xl border p-2.5">
                  <div>
                    <p className="text-xs font-medium">{m.marketer}</p>
                    <p className="text-[10px] text-muted-foreground">{faNumber(m.contracts)} قرارداد</p>
                  </div>
                  <div className="text-left text-[11px]">
                    <p>کل: {faMoneyShort(m.total)}</p>
                    <p className="text-emerald-700">پرداختی: {faMoneyShort(m.paid)}</p>
                  </div>
                </div>
              ))}
              {data.byMarketer.length === 0 && <p className="text-xs text-muted-foreground">داده‌ای موجود نیست</p>}
            </div>
          </CardBlock>
        </div>
      </div>
    </div>
  );
}
