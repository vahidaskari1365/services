"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../store";
import { EmptyState, SectionTitle, StatusBadge, LoadingCards } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { faMoneyShort, faNumber, faPercent } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";
import { Percent, TrendingUp } from "lucide-react";

interface CommissionRow {
  id: string; contractAmount: number; percent: number; totalAmount: number;
  signPart: number; signPaid: boolean; collectionTarget: number; collectionPaid: number;
  status: string; createdAt: string;
  collectionRatio: number; currentCollectionShare: number;
  contract: { id: string; title: string; project: { name: string } };
  marketer: { fullName: string; marketerCode: string };
}
interface Tier { id: string; label: string; minAmount: number; maxAmount: number | null; percent: number }

// نمای بازاریاب — پروژه‌های خودش و وضعیت پورسانت پلکانی
export default function CommissionsView() {
  const { toast } = useToast();
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<{ commissions: CommissionRow[]; tiers: Tier[] }>("/api/commissions");
      setCommissions(data.commissions);
      setTiers(data.tiers);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingCards count={4} />;

  const totalEarned = commissions.reduce((s, c) => s + (c.signPaid ? c.signPart : 0) + c.collectionPaid, 0);
  const totalPotential = commissions.reduce((s, c) => s + c.totalAmount, 0);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="پورسانت من"
        desc="محاسبه پلکانی بر مبنای مبلغ قرارداد — سهم عقد قرارداد + سهم وصول متناسب با مطالبات کارفرما"
      />

      <div className="grid gap-3 grid-cols-2">
        <div className="rounded-2xl border bg-emerald-50 border-emerald-200 p-4">
          <p className="text-xs text-emerald-700">پورسانت دریافتی</p>
          <p className="text-xl font-extrabold text-emerald-800 mt-1">{faMoneyShort(totalEarned)} ریال</p>
        </div>
        <div className="rounded-2xl border bg-muted p-4">
          <p className="text-xs text-muted-foreground">پورسانت کل برآوردی</p>
          <p className="text-xl font-extrabold mt-1">{faMoneyShort(totalPotential)} ریال</p>
        </div>
      </div>

      {tiers.length > 0 && (
        <div className="rounded-2xl border p-4">
          <p className="text-sm font-bold flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> پلکان پورسانت جاری سیستم
          </p>
          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => (
              <Badge key={t.id} variant="outline" className="text-[11px] py-1">
                {t.label}: {faPercent(t.percent)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {commissions.length === 0 && <EmptyState title="پورسانتی برای شما ثبت نشده" desc="وقتی قراردادی با معرفی شما ثبت شود اینجا نمایش داده می‌شود" />}
        {commissions.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold">{c.contract.project.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{c.contract.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  مبلغ قرارداد: {faMoneyShort(c.contractAmount)} ریال — نرخ پلکان: {faPercent(c.percent)}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">ثبت: {formatJalali(c.createdAt)}</p>
              </div>
              <div className="text-left">
                <p className="text-lg font-extrabold text-emerald-700 flex items-center gap-1">
                  <Percent className="w-4 h-4" /> {faMoneyShort(c.totalAmount)}
                </p>
                <div className="mt-1"><StatusBadge status={c.status} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className={`rounded-xl border p-2.5 ${c.signPaid ? "border-emerald-200 bg-emerald-50" : ""}`}>
                <p className="text-[10px] text-muted-foreground">سهم عقد قرارداد (۵۰٪)</p>
                <p className="text-xs font-bold mt-0.5">{faMoneyShort(c.signPart)} ریال</p>
                <Badge className={`mt-1 text-[9px] border-0 ${c.signPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {c.signPaid ? "پرداخت شده" : "در انتظار پرداخت"}
                </Badge>
              </div>
              <div className="rounded-xl border p-2.5">
                <p className="text-[10px] text-muted-foreground">سهم وصول مطالبات (۵۰٪)</p>
                <p className="text-xs font-bold mt-0.5">{faMoneyShort(c.collectionTarget)} ریال</p>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${c.collectionRatio}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  وصول مصالح: {faPercent(c.collectionRatio)} — سهم جاری: {faMoneyShort(c.currentCollectionShare)} — پرداختی: {faMoneyShort(c.collectionPaid)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
