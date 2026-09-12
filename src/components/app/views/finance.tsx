"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useApp } from "../store";
import { CardBlock, EmptyState, SectionTitle, StatusBadge, LoadingCards, DueInfo } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { faMoneyShort, faNumber } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";
import { Copy, Link2, RefreshCw, Wallet } from "lucide-react";

interface Installment {
  id: string; title: string; amount: number; dueDate: string; status: string; escalationStage: number;
  contract: { title: string; project: { name: string; employer: { fullName: string } | null } };
  paymentLinks: { id: string; token: string; status: string; amount: number }[];
  payments: { id: string; amount: number; method: string; paidAt: string }[];
}
interface Payment {
  id: string; amount: number; method: string; paidAt: string; gatewayRef: string;
  accountingSynced: boolean; accountingRef: string; note: string;
}
interface Payout {
  id: string; type: string; netAmount: number; status: string; blockReason: string; hardGatePassed: boolean;
  contract: { title: string; project: { name: string } };
  team: { name: string } | null;
}

export default function FinanceView() {
  const can = useApp((s) => s.can);
  const { toast } = useToast();
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manualTarget, setManualTarget] = useState<Installment | null>(null);
  const [manualMethod, setManualMethod] = useState("CASH");

  const load = useCallback(async () => {
    try {
      const [fin, po] = await Promise.all([
        api<{ installments: Installment[]; payments: Payment[] }>("/api/installments"),
        api<{ payouts: Payout[] }>("/api/payouts"),
      ]);
      setInstallments(fin.installments);
      setPayments(fin.payments);
      setPayouts(po.payouts);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function issueLink(inst: Installment) {
    setBusy(true);
    try {
      const data = await api<{ link: { token: string } }>("/api/installments", {
        method: "POST",
        body: JSON.stringify({ installmentId: inst.id }),
      });
      const url = `${window.location.origin}/?pay=${data.link.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast({
        title: "لینک پرداخت صادر شد (کپی شد)",
        description: `مبلغ غیرقابل تغییر: ${faMoneyShort(inst.amount)} ریال — لینک: ${url}`,
        duration: 8000,
      });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function simulateGateway(token: string) {
    setBusy(true);
    try {
      // فراخوانی درگاه از مسیر عمومی (شبیه‌سازی پرداخت کارفرما)
      const res = await fetch(`/api/pay/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "پرداخت موفق", description: `کد پیگیری درگاه: ${data.gatewayRef}` });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function registerManual() {
    if (!manualTarget) return;
    setBusy(true);
    try {
      await api("/api/installments", {
        method: "PUT",
        body: JSON.stringify({ installmentId: manualTarget.id, method: manualMethod }),
      });
      toast({ title: "وصولی دستی ثبت شد" });
      setManualTarget(null);
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function syncAccounting() {
    setBusy(true);
    try {
      const data = await api<{ syncedCount: number; note: string }>("/api/installments", { method: "PATCH" });
      toast({ title: "همگام‌سازی حسابفاری", description: `${faNumber(data.syncedCount)} سند ارسال شد` });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  if (loading) return <LoadingCards count={6} />;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="هاب مالی و حسابداری"
        desc="اقساط کارفرما، لینک پرداخت آنلاین با مبلغ غیرقابل تغییر، تسویه‌ها و همگام‌سازی اسناد با نرم‌افزار حسابداری"
        action={
          can("accounting.sync") && (
            <Button size="sm" variant="outline" onClick={syncAccounting} disabled={busy}>
              <RefreshCw className="w-4 h-4 ml-1" /> همگام‌سازی حسابفاری
            </Button>
          )
        }
      />

      <Tabs defaultValue="installments">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="installments" className="text-xs">اقساط کارفرما ({faNumber(installments.length)})</TabsTrigger>
          <TabsTrigger value="payments" className="text-xs">وصولی‌ها ({faNumber(payments.length)})</TabsTrigger>
          <TabsTrigger value="payouts" className="text-xs">تسویه پیمانکاران ({faNumber(payouts.length)})</TabsTrigger>
        </TabsList>

        <TabsContent value="installments" className="mt-4 space-y-2">
          {installments.length === 0 && <EmptyState title="قسطی ثبت نشده" />}
          {installments.map((i) => {
            const activeLink = i.paymentLinks.find((l) => l.status === "ACTIVE");
            return (
              <div key={i.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs font-semibold">{i.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {i.contract.project.name} — {i.contract.title} — پرداخت‌کننده: {i.contract.project.employer?.fullName || "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {faMoneyShort(i.amount)} ریال — سررسید: {formatJalali(i.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DueInfo date={i.dueDate} />
                    <StatusBadge status={i.status} />
                    {i.escalationStage > 0 && i.status === "PENDING" && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                        پیگیری: مرحله {faNumber(i.escalationStage)}
                      </Badge>
                    )}
                  </div>
                </div>
                {i.status === "PENDING" && can("payments.link") && (
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => issueLink(i)}>
                      <Link2 className="w-3.5 h-3.5 ml-1" /> صدور لینک پرداخت
                    </Button>
                    {activeLink && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={async () => {
                            const url = `${window.location.origin}/?pay=${activeLink.token}`;
                            await navigator.clipboard.writeText(url).catch(() => {});
                            toast({ title: "لینک کپی شد" });
                          }}
                        >
                          <Copy className="w-3.5 h-3.5 ml-1" /> کپی لینک
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-700" disabled={busy} onClick={() => simulateGateway(activeLink.token)}>
                          <Wallet className="w-3.5 h-3.5 ml-1" /> شبیه‌سازی پرداخت درگاه
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={busy} onClick={() => setManualTarget(i)}>
                      ثبت وصولی دستی
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <CardBlock title="آخرین وصولی‌ها">
            {payments.length === 0 ? (
              <EmptyState title="وصولی ثبت نشده" />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pl-1">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold">{faMoneyShort(p.amount)} ریال</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {p.note || "—"} — {formatJalali(p.paidAt, true)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={p.method} />
                      {p.accountingSynced ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">سناد: {p.accountingRef}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">همگام‌سازی نشده</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBlock>
        </TabsContent>

        <TabsContent value="payouts" className="mt-4">
          <CardBlock title="تسویه اکیپ‌ها و سرپرستان">
            {payouts.length === 0 ? (
              <EmptyState title="تسویه‌ای ثبت نشده" desc="درخواست تسویه از صفحه پروژه‌ها ثبت می‌شود" />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pl-1">
                {payouts.map((p) => (
                  <div key={p.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-xs font-semibold">
                          {p.contract.project.name} — {p.contract.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {p.type === "TEAM" ? "تسویه اکیپ" : "تسویه سرپرست"} {p.team && `— ${p.team.name}`} — خالص: {faMoneyShort(p.netAmount)} ریال
                        </p>
                        {p.blockReason && <p className="text-[11px] text-rose-600 mt-0.5">{p.blockReason}</p>}
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBlock>
        </TabsContent>
      </Tabs>

      {/* دیالوگ وصولی دستی */}
      <Dialog open={!!manualTarget} onOpenChange={(o) => !o && setManualTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ثبت وصولی دستی</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {manualTarget?.title} — {manualTarget && faMoneyShort(manualTarget.amount)} ریال
          </p>
          <Select value={manualMethod} onValueChange={setManualMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">نقدی</SelectItem>
              <SelectItem value="TRANSFER">کارت به کارت</SelectItem>
              <SelectItem value="GATEWAY">درگاه</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualTarget(null)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={registerManual} disabled={busy}>ثبت وصولی</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
