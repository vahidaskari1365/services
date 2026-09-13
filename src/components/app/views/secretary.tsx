"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../store";
import { EmptyState, SectionTitle, LoadingCards } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { faNumber } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";
import { CheckCircle2, Inbox, Phone, PhoneOff } from "lucide-react";

interface CallLog {
  id: string; result: string; note: string; createdAt: string;
}
interface Escalation {
  id: string; kind: string; severity: string; title: string; description: string;
  assignedRole: string; status: string; resultNote: string; createdAt: string;
  callLogs: CallLog[];
}

const KIND_LABEL: Record<string, string> = {
  INSTALLMENT_UNPAID: "قسط پرداخت‌نشده",
  TASK_OVERDUE: "تاخیر وظیفه",
  BALANCE_MISSING: "عدم ثبت تراز مصالح",
  CHECK_EXPIRED: "چک ضمانت منقضی",
};
const CALL_RESULTS = [
  { key: "ANSWERED", label: "پاسخ داد" },
  { key: "NO_ANSWER", label: "پاسخ نداد" },
  { key: "PROMISED", label: "قول پرداخت/اقدام داد" },
  { key: "REFUSED", label: "امتناع کرد" },
];

// کارتابل منشی — صف ارجاعات موتور پیگیری با شماره‌گیری سریع و ثبت نتیجه تماس
export default function SecretaryView() {
  const { toast } = useToast();
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [callTarget, setCallTarget] = useState<Escalation | null>(null);
  const [callResult, setCallResult] = useState("ANSWERED");
  const [callNote, setCallNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ escalations: Escalation[] }>("/api/escalations?status=OPEN");
      setEscalations(data.escalations);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 25000);
    return () => clearInterval(t);
  }, [load]);

  async function logCall() {
    if (!callTarget) return;
    setBusy(true);
    try {
      await api(`/api/escalations/${callTarget.id}`, {
        method: "POST",
        body: JSON.stringify({ result: callResult, note: callNote }),
      });
      toast({ title: "نتیجه تماس ثبت شد" });
      setCallTarget(null);
      setCallNote("");
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function resolve(esc: Escalation) {
    setBusy(true);
    try {
      await api(`/api/escalations/${esc.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE", resultNote: "پیگیری شد و بسته شد" }),
      });
      toast({ title: "ارجاع بسته شد" });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  if (loading) return <LoadingCards count={4} />;

  const critical = escalations.filter((e) => e.severity === "CRITICAL");

  return (
    <div className="space-y-5">
      <SectionTitle
        title="کارتابل پیگیری (صف ارجاعات)"
        desc="ارجاع خودکار موتور پیگیری: اقساط معوق ۹۶ ساعته، وظایف بحرانی، تراز مصالح ثبت‌نشده و چک‌های منقضی"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="bg-rose-100 text-rose-700 border-0 text-[11px]">
          <Inbox className="w-3 h-3 ml-1" /> {faNumber(escalations.length)} ارجاع باز
        </Badge>
        {critical.length > 0 && (
          <Badge className="bg-rose-600 text-white border-0 text-[11px]">{faNumber(critical.length)} بحرانی</Badge>
        )}
        <Badge variant="outline" className="text-[10px]">به‌روزرسانی خودکار هر ۲۵ ثانیه</Badge>
      </div>

      <div className="space-y-3">
        {escalations.length === 0 && <EmptyState title="ارجاع بازی وجود ندارد" desc="وقتی موتور پیگیری موردی شناسایی کند اینجا می‌بینید" />}
        {escalations.map((e) => (
          <div key={e.id} className={`rounded-2xl border bg-card p-4 ${e.severity === "CRITICAL" ? "border-rose-300" : "border-amber-200"}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{KIND_LABEL[e.kind] || e.kind}</Badge>
                  <Badge className={`text-[10px] border-0 ${e.severity === "CRITICAL" ? "bg-rose-600 text-white" : "bg-amber-100 text-amber-800"}`}>
                    {e.severity === "CRITICAL" ? "بحرانی" : "مهم"}
                  </Badge>
                </div>
                <p className="text-sm font-bold mt-2">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-5">{e.description}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">ثبت: {formatJalali(e.createdAt, true)}</p>
                {e.callLogs.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {e.callLogs.map((c) => (
                      <p key={c.id} className="text-[11px] rounded-lg bg-muted px-2 py-1">
                        تماس ({CALL_RESULTS.find((r) => r.key === c.result)?.label || c.result}) — {c.note || "بدون یادداشت"} — {formatJalali(c.createdAt, true)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setCallTarget(e); setCallResult("ANSWERED"); }}>
                  <Phone className="w-4 h-4 ml-1" /> ثبت نتیجه تماس
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve(e)}>
                  <CheckCircle2 className="w-4 h-4 ml-1" /> بستن
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* دیالوگ نتیجه تماس */}
      <Dialog open={!!callTarget} onOpenChange={(o) => !o && setCallTarget(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-600" /> ثبت نتیجه تماس
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{callTarget?.title}</p>
          <Select value={callResult} onValueChange={setCallResult}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CALL_RESULTS.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="یادداشت تماس (مثلاً: قول پرداخت تا پایان هفته)…"
            value={callNote}
            onChange={(e) => setCallNote(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallTarget(null)}>
              <PhoneOff className="w-4 h-4 ml-1" /> انصراف
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={logCall} disabled={busy}>ثبت</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
