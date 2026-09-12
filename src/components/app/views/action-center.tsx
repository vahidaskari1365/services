"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../store";
import { CardBlock, EmptyState, SectionTitle, StatusBadge, LoadingCards } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Check, ClipboardCheck, Loader2, X } from "lucide-react";
import { faMoneyShort, faNumber } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

interface Approval {
  id: string;
  type: string;
  refId: string;
  title: string;
  amount: number | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  note: string;
}

const TYPE_LABEL: Record<string, string> = {
  WORKLOG: "کارکرد",
  PAYOUT: "تسویه",
  MATERIAL_BALANCE: "تراز مصالح",
  CONTRACT: "قرارداد",
  EXPENSE_ITEM: "آیتم هزینه",
};

export default function ActionCenterView() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Approval | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const data = await api<{ approvals: Approval[] }>("/api/approvals");
      setApprovals(data.approvals);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000); // فید زنده
    return () => clearInterval(t);
  }, [load]);

  async function decide(approval: Approval, decision: "APPROVED" | "REJECTED", note = "") {
    setBusyId(approval.id);
    try {
      await api("/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id: approval.id, decision, note }),
      });
      toast({
        title: decision === "APPROVED" ? "تأیید شد" : "رد شد",
        description: approval.title,
      });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusyId(null);
      setRejectTarget(null);
      setRejectNote("");
    }
  }

  if (loading) return <LoadingCards count={6} />;

  const pending = approvals.filter((a) => a.status === "PENDING");
  const decided = approvals.filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-5">
      <SectionTitle
        title="مرکز عملیات"
        desc="فید زنده تأییدیه‌ها — تأیید یا رد یک‌کلیکی بدون ورود به پرونده هر پروژه"
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold">در انتظار تأیید ({faNumber(pending.length)})</h3>
            <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px]">فید زنده هر ۲۰ ثانیه</Badge>
          </div>
          {pending.length === 0 ? (
            <CardBlock title="">
              <EmptyState title="تأییدیه در انتظاری وجود ندارد" desc="همه درخواست‌ها تعیین تکلیف شده‌اند" />
            </CardBlock>
          ) : (
            pending.map((a) => (
              <div key={a.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[a.type] || a.type}</Badge>
                      {a.amount !== null && a.amount > 0 && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px]">{faMoneyShort(a.amount)} ریال</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-2 leading-6">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">ثبت شده: {formatJalali(a.createdAt, true)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 min-w-20"
                      disabled={busyId === a.id}
                      onClick={() => decide(a, "APPROVED")}
                    >
                      {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 ml-1" />}
                      تأیید
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 min-w-20"
                      disabled={busyId === a.id}
                      onClick={() => setRejectTarget(a)}
                    >
                      <X className="w-4 h-4 ml-1" />
                      رد
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          <CardBlock title={`تاریخچه تعیین تکلیف (${faNumber(decided.length)})`}>
            {decided.length === 0 ? (
              <EmptyState title="تاریخچه‌ای وجود ندارد" />
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pl-1">
                {decided.map((a) => (
                  <div key={a.id} className="rounded-xl border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={a.status} />
                      <span className="text-[10px] text-muted-foreground">{a.decidedAt ? formatJalali(a.decidedAt, true) : ""}</span>
                    </div>
                    <p className="text-xs mt-1.5 leading-5">{a.title}</p>
                    {a.note && <p className="text-[11px] text-rose-600 mt-1">دلیل رد: {a.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardBlock>
        </div>
      </div>

      {/* دیالوگ رد با ذکر دلیل */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-rose-500" />
              رد تأییدیه
            </DialogTitle>
            <DialogDescription>{rejectTarget?.title}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="دلیل رد (اختیاری ولی توصیه می‌شود)…"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>انصراف</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              disabled={busyId === rejectTarget?.id}
              onClick={() => rejectTarget && decide(rejectTarget, "REJECTED", rejectNote)}
            >
              ثبت رد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
