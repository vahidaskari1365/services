"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useApp } from "../store";
import { EmptyState, SectionTitle, StatusBadge, LoadingCards, DueInfo } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { faMoneyShort, faNumber } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";
import { gregorianToIso } from "@/lib/jalali-client";
import { Camera, CheckCircle2, MapPin, Plus, Receipt } from "lucide-react";

interface Task {
  id: string; title: string; description: string; status: string; priority: string;
  dueDate: string; isBottleneck: boolean; completedAt: string | null;
  project: { id: string; name: string; serviceLine: { name: string } | null };
  assigneePerson: { fullName: string } | null;
}
interface ProjectOpt {
  id: string; name: string;
  phases: { id: string; title: string }[];
  contracts: { id: string; title: string; type: string; materialItems: { id: string; name: string; unit: string; unitPrice: number; plannedQty: number }[] }[];
}
interface Team { id: string; name: string }

// نمای موبایل بهینه‌شده سرپرست کارگاه (PWA-Style)
export default function MyTasksView() {
  const user = useApp((s) => s.user);
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [worklogTarget, setWorklogTarget] = useState<Task | null>(null);
  const [balanceTarget, setBalanceTarget] = useState<ProjectOpt | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, p, tm] = await Promise.all([
        api<{ tasks: Task[] }>("/api/tasks?scope=own"),
        api<{ projects: ProjectOpt[] }>("/api/projects"),
        api<{ teams: Team[] }>("/api/teams"),
      ]);
      setTasks(t.tasks);
      setProjects(p.projects);
      setTeams(tm.teams);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function completeTask(task: Task) {
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status: "DONE" }) });
      toast({ title: "وظیفه انجام شد", description: task.title });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    }
  }

  if (loading) return <LoadingCards count={4} />;

  const open = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");

  return (
    <div className="space-y-5">
      <SectionTitle
        title={`وظایف من — ${user?.fullName || "سرپرست"}`}
        desc="نمای بهینه‌شده موبایل: وظایف بین‌پروژه‌ای به ترتیب اولویت + ثبت سریع اقدام با شواهد"
      />

      {/* وظایف باز */}
      <div className="space-y-3">
        {open.length === 0 && <EmptyState title="وظیفه بازی ندارید" desc="وقتی وظیفه جدیدی تخصیص داده شود اینجا می‌بینید" />}
        {open.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl border bg-card p-4 ${t.isBottleneck && t.status !== "DONE" ? "border-rose-300 bg-rose-50/40" : ""}`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {t.isBottleneck && <Badge className="bg-rose-100 text-rose-700 border-0 text-[10px]">گلوگاه بحرانی</Badge>}
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-sm font-bold mt-2">{t.title}</p>
                {t.description && <p className="text-xs text-muted-foreground mt-1 leading-5">{t.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {t.project.name} ({t.project.serviceLine?.name || "—"})
                  </span>
                  <DueInfo date={t.dueDate} />
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setWorklogTarget(t)}>
                  <Camera className="w-4 h-4 ml-1" /> ثبت اقدام و کارکرد
                </Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => completeTask(t)}>
                  <CheckCircle2 className="w-4 h-4 ml-1" /> انجام شد
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* دسترسی سریع تراز مصالح */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4">
        <p className="text-sm font-bold text-teal-800">ثبت تراز مصالح (پیش‌نیاز سد سخت تسویه)</p>
        <p className="text-[11px] text-teal-700/80 mt-1">
          برای قراردادهای بامصالح، پیش از هر تسویه باید تراز (مصرف/مازاد/کسری) هر مرحله ثبت شود.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {projects
            .filter((p) => p.contracts.some((c) => c.type === "WITH_MATERIALS"))
            .map((p) => (
              <Button key={p.id} size="sm" variant="outline" className="text-xs bg-white" onClick={() => setBalanceTarget(p)}>
                <Receipt className="w-3.5 h-3.5 ml-1" /> {p.name}
              </Button>
            ))}
          {projects.filter((p) => p.contracts.some((c) => c.type === "WITH_MATERIALS")).length === 0 && (
            <p className="text-xs text-muted-foreground">قرارداد بامصالحی ندارید.</p>
          )}
        </div>
      </div>

      {/* انجام‌شده‌ها */}
      {done.length > 0 && (
        <div>
          <h3 className="text-sm font-bold mb-2">انجام‌شده ({faNumber(done.length)})</h3>
          <div className="space-y-2">
            {done.map((t) => (
              <div key={t.id} className="rounded-xl border bg-muted/30 p-2.5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground line-through">{t.title}</p>
                <span className="text-[10px] text-muted-foreground">{formatJalali(t.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* دیالوگ ثبت کارکرد با شواهد */}
      {worklogTarget && (
        <WorklogDialog
          task={worklogTarget}
          projects={projects}
          teams={teams}
          onClose={() => setWorklogTarget(null)}
          onSaved={() => { setWorklogTarget(null); load(); toast({ title: "کارکرد ثبت شد", description: "در انتظار تأیید مدیر" }); }}
        />
      )}

      {/* دیالوگ تراز مصالح */}
      {balanceTarget && (
        <BalanceDialog
          project={balanceTarget}
          onClose={() => setBalanceTarget(null)}
          onSaved={() => { setBalanceTarget(null); load(); toast({ title: "تراز مصالح ثبت شد", description: "تاییدیه برای مدیر ارسال شد" }); }}
        />
      )}
    </div>
  );
}

// ── ثبت کارکرد با موتور تعرفه + شواهد ──
function WorklogDialog({ task, projects, teams, onClose, onSaved }: {
  task: Task;
  projects: ProjectOpt[];
  teams: Team[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(task.title);
  const [tariffType, setTariffType] = useState("FIXED");
  const [baseAmount, setBaseAmount] = useState("");
  const [rate, setRate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [extraUnits, setExtraUnits] = useState("");
  const [extraRate, setExtraRate] = useState("");
  const [evidences, setEvidences] = useState<{ kind: string; title: string }[]>([
    { kind: "PHOTO", title: "" },
  ]);
  const [busy, setBusy] = useState(false);

  const project = projects.find((p) => p.id === task.project.id);
  const contract = project?.contracts[0];

  const preview =
    tariffType === "FIXED" ? Number(baseAmount) || 0
    : tariffType === "METERED" ? (Number(rate) || 0) * (Number(quantity) || 0)
    : (Number(baseAmount) || 0) + (Number(extraUnits) || 0) * (Number(extraRate) || 0);

  async function submit() {
    if (!contract || !description.trim()) return;
    setBusy(true);
    try {
      await api("/api/worklogs", {
        method: "POST",
        body: JSON.stringify({
          projectId: task.project.id,
          contractId: contract.id,
          description,
          tariffType,
          baseAmount: Number(baseAmount) || 0,
          rate: Number(rate) || 0,
          quantity: Number(quantity) || 0,
          extraUnits: Number(extraUnits) || 0,
          extraRate: Number(extraRate) || 0,
          teamId: teams[0]?.id || null,
          evidences: evidences.filter((e) => e.title.trim()).map((e) => ({ kind: e.kind, title: e.title, value: "" })),
        }),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت کارکرد و اقدام</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">
            پروژه: {task.project.name} — قرارداد: {contract?.title || "—"}
          </p>
          <div className="space-y-1.5">
            <Label>شرح اقدام *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>الگوی تعرفه</Label>
            <Select value={tariffType} onValueChange={setTariffType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">مقطوع (مبلغ ثابت خدمت)</SelectItem>
                <SelectItem value="METERED">متراژی (نرخ × متراژ)</SelectItem>
                <SelectItem value="BASE_PLUS_EXTRA">پایه + واحد اضافه</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {tariffType !== "METERED" && (
              <div className="space-y-1.5">
                <Label>{tariffType === "FIXED" ? "مبلغ ثابت (ریال)" : "مبلغ پایه (ریال)"}</Label>
                <Input dir="ltr" inputMode="numeric" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} />
              </div>
            )}
            {tariffType === "METERED" && (
              <>
                <div className="space-y-1.5">
                  <Label>نرخ واحد (ریال)</Label>
                  <Input dir="ltr" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>متراژ</Label>
                  <Input dir="ltr" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
              </>
            )}
            {tariffType === "BASE_PLUS_EXTRA" && (
              <>
                <div className="space-y-1.5">
                  <Label>واحد مازاد</Label>
                  <Input dir="ltr" inputMode="numeric" value={extraUnits} onChange={(e) => setExtraUnits(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>نرخ واحد مازاد</Label>
                  <Input dir="ltr" inputMode="numeric" value={extraRate} onChange={(e) => setExtraRate(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
            <p className="text-xs font-bold text-emerald-700">مبلغ محاسبه‌شده: {faMoneyShort(preview)} ریال</p>
          </div>
          <div className="space-y-1.5">
            <Label>شواهد (عکس، لوکیشن، فاکتور، تنخواه)</Label>
            {evidences.map((ev, i) => (
              <div key={i} className="flex gap-2">
                <Select
                  value={ev.kind}
                  onValueChange={(v) => setEvidences(evidences.map((x, j) => (j === i ? { ...x, kind: v } : x)))}
                >
                  <SelectTrigger className="w-32 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHOTO">عکس</SelectItem>
                    <SelectItem value="LOCATION">لوکیشن</SelectItem>
                    <SelectItem value="INVOICE">فاکتور</SelectItem>
                    <SelectItem value="PETTY_CASH">تنخواه</SelectItem>
                    <SelectItem value="NOTE">یادداشت</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="عنوان/شرح شاهد…"
                  value={ev.title}
                  onChange={(e) => setEvidences(evidences.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                />
                <Button variant="ghost" size="icon" onClick={() => setEvidences(evidences.filter((_, j) => j !== i))} aria-label="حذف">
                  ×
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={() => setEvidences([...evidences, { kind: "PHOTO", title: "" }])}>
              <Plus className="w-3.5 h-3.5 ml-1" /> افزودن شاهد
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy || !contract}>ثبت و ارسال برای تأیید</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ثبت تراز مصالح (Hard Gate input) ──
function BalanceDialog({ project, onClose, onSaved }: { project: ProjectOpt; onClose: () => void; onSaved: () => void }) {
  const materialContracts = project.contracts.filter((c) => c.type === "WITH_MATERIALS");
  const [contractId, setContractId] = useState(materialContracts[0]?.id || "");
  const contract = materialContracts.find((c) => c.id === contractId);
  const phases = project.phases;
  const [phaseId, setPhaseId] = useState(phases[0]?.id || "");
  const [rows, setRows] = useState<{ materialItemId: string; consumedQty: string; surplusQty: string; shortageQty: string; notes: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (contract) {
      setRows(contract.materialItems.map((m) => ({ materialItemId: m.id, consumedQty: "", surplusQty: "", shortageQty: "", notes: "" })));
    }
  }, [contractId, contract]);

  async function submit() {
    if (!contract || !phaseId) return;
    setBusy(true);
    try {
      const data = await api<{ gate: { passed: boolean; message: string } }>(`/api/contracts/${contract.id}`, {
        method: "POST",
        body: JSON.stringify({
          phaseId,
          balances: rows.map((r) => ({
            materialItemId: r.materialItemId,
            consumedQty: Number(r.consumedQty) || 0,
            surplusQty: Number(r.surplusQty) || 0,
            shortageQty: Number(r.shortageQty) || 0,
            notes: r.notes,
          })),
        }),
      });
      toast({ title: data.gate.passed ? "تراز کامل — تسویه باز شد" : "تراز ثبت شد", description: data.gate.message, duration: 5000 });
      onSaved();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ثبت گزارش تراز مصالح</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>قرارداد</Label>
              <Select value={contractId} onValueChange={setContractId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {materialContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>مرحله</Label>
              <Select value={phaseId} onValueChange={setPhaseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {phases.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            {contract?.materialItems.map((m, i) => (
              <div key={m.id} className="rounded-xl border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    برنامه: {faNumber(m.plannedQty)} {m.unit} — قیمت واحد: {faMoneyShort(m.unitPrice)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">مصرف</Label>
                    <Input dir="ltr" inputMode="numeric" value={rows[i]?.consumedQty || ""} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, consumedQty: e.target.value } : r)))} />
                  </div>
                  <div>
                    <Label className="text-[10px]">مازاد</Label>
                    <Input dir="ltr" inputMode="numeric" value={rows[i]?.surplusQty || ""} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, surplusQty: e.target.value } : r)))} />
                  </div>
                  <div>
                    <Label className="text-[10px] text-rose-600">کسری (خودکار از دستمزد کسر می‌شود)</Label>
                    <Input dir="ltr" inputMode="numeric" value={rows[i]?.shortageQty || ""} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, shortageQty: e.target.value } : r)))} />
                  </div>
                </div>
                <Input placeholder="یادداشت…" value={rows[i]?.notes || ""} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, notes: e.target.value } : r)))} />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>انصراف</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy}>ثبت تراز و ارسال تاییدیه</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
