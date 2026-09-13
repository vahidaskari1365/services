"use client";

// گزارش‌ساز — انتخاب مجموعه‌داده، فیلتر، نمودار گروه‌بندی و خروجی اکسل/CSV/چاپ (مجوز: reports.build)
import { useEffect, useMemo, useState } from "react";
import { api } from "../store";
import { CardBlock, EmptyState, LoadingCards, SectionTitle } from "../shared";
import ExportButtons from "../export-buttons";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "../shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { faMoneyShort, faNumber } from "@/lib/format";
import type { ExportCol } from "@/lib/export";
import { BarChart3, Filter, SlidersHorizontal } from "lucide-react";

interface DatasetInfo { key: string; label: string }
interface ProjectLite { id: string; name: string }
interface Row { id?: string; [k: string]: unknown }

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  projects: [
    { value: "ACTIVE", label: "فعال" },
    { value: "PAUSED", label: "متوقف موقت" },
    { value: "STOPPED", label: "متوقف شده" },
    { value: "DONE", label: "خاتمه یافته" },
  ],
  contracts: [
    { value: "ACTIVE", label: "فعال" },
    { value: "PENDING", label: "در انتظار" },
    { value: "TERMINATED", label: "فسخ شده" },
    { value: "DONE", label: "خاتمه یافته" },
  ],
  installments: [
    { value: "PENDING", label: "در انتظار" },
    { value: "PAID", label: "پرداخت شده" },
    { value: "PARTIAL", label: "پرداخت جزئی" },
  ],
  payments: [],
  worklogs: [
    { value: "PENDING", label: "در انتظار تأیید" },
    { value: "APPROVED", label: "تأیید شده" },
    { value: "REJECTED", label: "رد شده" },
  ],
  tasks: [
    { value: "TODO", label: "انجام نشده" },
    { value: "IN_PROGRESS", label: "در جریان" },
    { value: "BLOCKED", label: "مسدود" },
    { value: "DONE", label: "انجام شده" },
  ],
  commissions: [
    { value: "PENDING", label: "در انتظار" },
    { value: "PARTIAL", label: "پرداخت جزئی" },
    { value: "SETTLED", label: "تسویه شده" },
  ],
};

const PERIOD_OPTIONS = [
  { value: "all", label: "همه زمان‌ها" },
  { value: "d30", label: "۳۰ روز اخیر" },
  { value: "m3", label: "۳ ماه اخیر" },
  { value: "y1", label: "یک سال اخیر" },
];

export default function ReportBuilderView() {
  const { toast } = useToast();
  const [datasets, setDatasets] = useState<DatasetInfo[] | null>(null);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [dataset, setDataset] = useState("installments");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [busy, setBusy] = useState(false);
  const [columns, setColumns] = useState<ExportCol[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [datasetLabel, setDatasetLabel] = useState("");
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [groupKey, setGroupKey] = useState("status");

  useEffect(() => {
    api<{ datasets: DatasetInfo[]; projects: ProjectLite[] }>("/api/reports/builder")
      .then((d) => {
        setDatasets(d.datasets);
        setProjects(d.projects);
      })
      .catch((e) => toast({ title: "خطا", description: e.message, variant: "destructive" }));
  }, [toast]);

  function changeDataset(v: string) {
    setDataset(v);
    setColumns([]);
    setRows([]);
    setHiddenCols([]);
    setStatus("all");
    setGroupKey("status");
  }

  async function run() {
    setBusy(true);
    try {
      const data = await api<{ columns: ExportCol[]; rows: Row[]; datasetLabel: string }>("/api/reports/builder", {
        method: "POST",
        body: JSON.stringify({ dataset, projectId: projectId === "all" ? null : projectId, status: status === "all" ? null : status, period }),
      });
      setColumns(data.columns);
      setRows(data.rows);
      setDatasetLabel(data.datasetLabel);
      setHiddenCols([]);
      // بعد از داده‌ها، گروه‌بندی پیش‌فرض روی ستون وضعیت/متنی
      const textCol = data.columns.find((c) => c.type === "status" || c.type === "text");
      if (textCol) setGroupKey(textCol.key);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const visibleCols = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key)), [columns, hiddenCols]);
  const moneyCols = useMemo(() => columns.filter((c) => c.type === "money"), [columns]);
  const numericCols = useMemo(() => columns.filter((c) => c.type === "number"), [columns]);

  // نمودار گروه‌بندی — جمع ستون اول مبلغ بر اساس ستون انتخابی
  const chartData = useMemo(() => {
    const moneyKey = moneyCols[0]?.key;
    if (!moneyKey || !groupKey) return [];
    const map = new Map<string, number>();
    for (const r of rows) {
      const g = String(r[groupKey] ?? "—") || "—";
      const v = typeof r[moneyKey] === "number" ? (r[moneyKey] as number) : 0;
      map.set(g, (map.get(g) || 0) + v);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, value }));
  }, [rows, groupKey, moneyCols]);

  const groupOptions = useMemo(() => columns.filter((c) => c.type === "text" || c.type === "status"), [columns]);

  function cellValue(r: Row, c: ExportCol) {
    const v = r[c.key];
    if (v === null || v === undefined || v === "") return "—";
    if (c.type === "money" && typeof v === "number") return faMoneyShort(v);
    if (c.type === "number" && typeof v === "number") return faNumber(v);
    if (c.type === "status") return <StatusBadge status={String(v)} />;
    return String(v);
  }

  const filterSummary = `${datasetLabel}${projectId !== "all" ? ` · ${projects.find((p) => p.id === projectId)?.name || ""}` : ""}${
    status !== "all" ? ` · ${STATUS_OPTIONS[dataset]?.find((s) => s.value === status)?.label || ""}` : ""
  } · ${PERIOD_OPTIONS.find((p) => p.value === period)?.label}`;

  return (
    <div className="space-y-4">
      <SectionTitle title="گزارش‌ساز" desc="ساخت گزارش دلخواه از اقساط، پرداخت‌ها، کارکردها، وظایف، قراردادها و پورسانت‌ها با فیلتر و خروجی اکسل" />

      {/* نوار فیلتر */}
      <CardBlock title="فیلترهای گزارش" headerAction={<Filter className="w-4 h-4 text-muted-foreground" />}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">نوع گزارش</p>
            <Select value={dataset} onValueChange={changeDataset}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(datasets || []).map((d) => (
                  <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">پروژه</p>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه پروژه‌ها</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">وضعیت</p>
            <Select value={status} onValueChange={setStatus} disabled={(STATUS_OPTIONS[dataset] || []).length === 0}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {(STATUS_OPTIONS[dataset] || []).map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">بازه زمانی</p>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={run} disabled={busy}>
              <SlidersHorizontal className="w-4 h-4" /> {busy ? "در حال تهیه…" : "تهیه گزارش"}
            </Button>
          </div>
        </div>
      </CardBlock>

      {columns.length > 0 && (
        <>
          {/* جمع‌های کلی */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">تعداد ردیف</p>
              <p className="text-lg font-extrabold mt-1">{faNumber(rows.length)}</p>
            </div>
            {moneyCols.slice(0, 2).map((c) => (
              <div key={c.key} className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">جمع {c.label}</p>
                <p className="text-lg font-extrabold mt-1 text-emerald-700">
                  {faMoneyShort(rows.reduce((s, r) => s + (typeof r[c.key] === "number" ? (r[c.key] as number) : 0), 0))}
                </p>
              </div>
            ))}
            {moneyCols.length + numericCols.length === 0 && (
              <div className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">نوع داده</p>
                <p className="text-lg font-extrabold mt-1">متنی</p>
              </div>
            )}
          </div>

          {/* نمودار گروه‌بندی */}
          {chartData.length > 0 && (
            <CardBlock
              title="نمودار گروه‌بندی"
              headerAction={
                <Select value={groupKey} onValueChange={setGroupKey}>
                  <SelectTrigger className="h-7 w-40 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {groupOptions.map((c) => (
                      <SelectItem key={c.key} value={c.key}>گروه‌بندی: {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              <div className="h-64" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, bottom: 4, left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontFamily: "Vazirmatn" }} width={130} />
                    <Tooltip
                      formatter={(v: number) => [`${faMoneyShort(v)} ریال`, moneyCols[0]?.label || ""]}
                      contentStyle={{ fontFamily: "Vazirmatn", fontSize: 12, direction: "rtl" }}
                    />
                    <Bar dataKey="value" fill="#059669" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBlock>
          )}

          {/* جدول + خروجی */}
          <CardBlock
            title={`${datasetLabel} — ${rows.length.toLocaleString("fa-IR")} ردیف`}
            headerAction={
              <div className="flex items-center gap-2 flex-wrap">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm"><BarChart3 className="w-4 h-4" /> ستون‌ها</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2" align="start">
                    {columns.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-muted">
                        <Checkbox
                          checked={!hiddenCols.includes(c.key)}
                          onCheckedChange={(v) =>
                            setHiddenCols((prev) => (v ? prev.filter((k) => k !== c.key) : [...prev, c.key]))
                          }
                        />
                        {c.label}
                      </label>
                    ))}
                  </PopoverContent>
                </Popover>
                <ExportButtons title={datasetLabel || "گزارش"} subtitle={filterSummary} cols={visibleCols} rows={rows} fileName={`report-${dataset}`} />
              </div>
            }
          >
            {rows.length === 0 ? (
              <EmptyState title="داده‌ای با این فیلترها یافت نشد" desc="فیلترها را تغییر دهید یا بازه زمانی را بزرگ‌تر کنید" />
            ) : (
              <div className="overflow-auto max-h-[480px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-muted-foreground border-b">
                      {visibleCols.map((c) => (
                        <th key={c.key} className="text-right py-2 px-2 font-medium whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id || i} className="border-b last:border-0 hover:bg-muted/40">
                        {visibleCols.map((c) => (
                          <td key={c.key} className="py-2 px-2 whitespace-nowrap">{cellValue(r, c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBlock>
        </>
      )}

      {columns.length === 0 && !busy && (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          نوع گزارش را انتخاب و روی «تهیه گزارش» بزنید — سپس می‌توانید ستون‌ها را بچینید، نمودار ببینید و خروجی اکسل یا چاپ بگیرید.
        </div>
      )}
    </div>
  );
}
