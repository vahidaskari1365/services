"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { faMoneyShort } from "@/lib/format";
import { Building2, CreditCard, Loader2, ShieldCheck } from "lucide-react";

interface LinkInfo {
  title: string;
  amount: number;
  payerName: string;
  status: string;
  projectName: string;
}

// شبیه‌سازی صفحه پرداخت آنلاین درگاه (شاپرک) — لینک با مبلغ غیرقابل تغییر
export default function PaymentModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ gatewayRef: string; amount: number } | null>(null);
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/pay/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setInfo(d.link);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function pay() {
    setPaying(true);
    try {
      const res = await fetch(`/api/pay/${token}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone({ gatewayRef: d.gatewayRef, amount: d.amount });
      toast({ title: "پرداخت با موفقیت انجام شد", description: `کد پیگیری: ${d.gatewayRef}` });
    } catch (e) {
      toast({ title: "خطا در پرداخت", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : error ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-rose-600">خطا</DialogTitle>
              <DialogDescription>{error}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>بستن</Button>
            </DialogFooter>
          </>
        ) : done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <ShieldCheck className="w-5 h-5" /> پرداخت موفق
              </DialogTitle>
              <DialogDescription>وصولی به صورت خودکار در سیستم ثبت و به حسابداری منعکس شد.</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-1.5 text-sm">
              <p>مبلغ پرداخت‌شده: <b>{faMoneyShort(done.amount)} ریال</b></p>
              <p className="text-xs text-muted-foreground">کد پیگیری درگاه: <span dir="ltr">{done.gatewayRef}</span></p>
            </div>
            <DialogFooter>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onClose}>بستن</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" /> درگاه پرداخت آنلاین
              </DialogTitle>
              <DialogDescription>شبیه‌سازی درگاه شاپرک — مبلغ این لینک غیرقابل تغییر است</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-xl border p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">{info?.title}</p>
                {info?.projectName && <p className="text-[11px] text-muted-foreground">پروژه: {info.projectName}</p>}
                <p className="text-2xl font-extrabold text-emerald-700">{faMoneyShort(info?.amount)} ریال</p>
                {info?.payerName && <p className="text-[11px] text-muted-foreground">پرداخت‌کننده: {info.payerName}</p>}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground rounded-lg bg-muted p-2.5">
                <Building2 className="w-4 h-4 shrink-0" />
                تراکنش با پروتکل امن انجام می‌شود و پس از پرداخت، رسید به‌صورت خودکار صادر می‌گردد.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>انصراف</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={pay} disabled={paying || info?.status !== "ACTIVE"}>
                {paying && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                {info?.status === "ACTIVE" ? "پرداخت" : "این لینک غیرفعال است"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
