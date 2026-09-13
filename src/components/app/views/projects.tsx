"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useApp } from "../store";
import { CardBlock, EmptyState, SectionTitle, StatusBadge, LoadingCards, DueInfo } from "../shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { faMoneyShort, faNumber, faPercent } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";
import { gregorianToIso } from "@/lib/jalali-client";
import {
  AlertOctagon, FolderKanban, Lock, Plus, ShieldAlert, Trash2, Unlock,
} from "lucide-react";

interface ProjectRow {
  id: string; name: string; code: string; status: string; address: string; notes: string;
  employer: { fullName: string } | null;
  supervisor: { fullName: string } | null;
  serviceLine: { name: string } | null;
  contracts: ContractRow[];
  phases: PhaseRow[];
  tasks: TaskRow[];
}
interface PhaseRow { id: string; title: string; order: number; status: string }
interface TaskRow { id: string; title: string; status: string; priority: string; dueDate: string; isBottleneck: boolean; assigneePerson: { fullName: string } | null }
interface ContractRow {
  id: string; title: string; type: string; signingMode: string; amount: number; status: string; notes: string;
  marketer: { fullName: string } | null;
  installments: InstallmentRow[];
  materialItems: MaterialItemRow[];
  balances: BalanceRow[];
  workLogs: WorkLogRow[];
  payouts: PayoutRow[];
  commissions: CommissionRow[];
}
interface InstallmentRow { id: string; title: string; amount: number; dueDate: string; status: string; escalationStage: number }
interface MaterialItemRow { id: string; name: string; unit: string; unitPrice: number; plannedQty: number; receipts: { qty: number }[] }
interface BalanceRow { materialItemId: string; phaseId: string; consumedQty: number; surplusQty: number; shortageQty: number }
interface WorkLogRow {
  id: string; date: string; description: string; status: string; tariffType: string;
  computedAmount: number; team: { name: string } | null; person: { fullName: string } | null;
  phase: { title: string } | null; evidences: { id: string; kind: string; title: string }[];
}
interface PayoutRow { id: string; type: string; netAmount: number; status: string; blockReason: string; hardGatePassed: boolean }
interface CommissionRow { id: string; percent: number; totalAmount: number; signPart: number; signPaid: boolean; collectionTarget: number; collectionPaid: number; marketer: { fullName: string } | null }
interface Gate {
  passed: boolean; contractType: string; totalShortage: number; wageTotal: number; netPayable: number; message: string;
  missingItems: { id: string; name: string }[];
  shortageLines: { itemName: string; qty: number; unitPrice: number; deduction: number }[];
}
interface PersonOpt { id: string; fullName: string; type: string }
interface LineOpt { id: string; name: string }

const EVIDENCE_LABEL: Record<string, string> = { PHOTO: "عکس", LOCATION: "لوکیشن", INVOICE: "فاکتور", PETTY_CASH: "تنخواه", NOTE: "یادداشت" };

export default function ProjectsView() {
  const can = useApp((s) => s.can);
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [gates, setGates] = useState<Record<string, Gate>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [persons, setPersons] = useState<PersonOpt[]>([]);
  const [lines, setLines] = useState<LineOpt[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ projects: ProjectRow[]; gates?: Record<string, Gate> }>("/api/projects");
      setProjects(data.projects);
      // گیت‌های سد سخت برای قراردادهای بامصالح
      const g: Record<string, Gate> = {};
      await Promise.all(
        data.projects.flatMap((p) =>
          p.contracts.filter((c) => c.type === "WITH_MATERIALS").map(async (c) => {
            try {
              const res = await api<{ gate: Gate }>(`/api/contracts/${c.id}`);
              g[c.id] = res.gate;
            } catch { /* skip */ }
          })
        )
      );
      setGates(g);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    api<{ persons: PersonOpt[] }>("/api/persons").then((d) => setPersons(d.persons)).catch(() => {});
    api<{ lines: LineOpt[] }>("/api/lines").then((d) => setLines(d.lines)).catch(() => {});
  }, [load]);

  if (loading) return <LoadingCards count={6} />;

  const current = projects.find((p) => p.id === selected);

  return (
    <div className="space-y-5">
      <SectionTitle
        title="پروژه‌ها و قراردادها"
        desc="هسته فنی سیستم — تفکیک قرارداد دستمزدی/بامصالح، مراحل اجرا، وظایف و سد سخت تراز مصالح"
        action={
          can("projects.manage") ? (
            <CreateProjectDialog
              persons={persons}
              lines={lines}
              onCreated={() => { load(); toast({ title: "پروژه ایجاد شد" }); }}
            />
          ) : undefined
        }
      />

      {/* لیست پروژه‌ها */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.length === 0 && <EmptyState title="پروژه‌ای ثبت نشده است" />}
        {projects.map((p) => {
          const total = p.contracts.reduce((s, c) => s + c.amount, 0);
          const bottlenecks = p.tasks.filter((t) => t.isBottleneck && t.status !== "DONE").length;
          const progress = p.phases.length ? Math.round((p.phases.filter((ph) => ph.status === "DONE").length / p.phases.length) * 100) : 0;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id === selected ? null : p.id)}
              className={`text-right rounded-2xl border p-4 transition-all hover:shadow-md ${
                selected === p.id ? "border-emerald-500 ring-2 ring-emerald-100 bg-emerald-50/40" : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-sm">{p.name}</p>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {p.code} — رسته {p.serviceLine?.name || "—"}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3 text-[11px] text-muted-foreground">
                <span>کارفرما: {p.employer?.fullName || "—"}</span>
                <span>سرپرست: {p.supervisor?.fullName || "—"}</span>
                <span>{faNumber(p.contracts.length)} قرارداد</span>
                <span className="font-medium text-foreground">{faMoneyShort(total)} ریال</span>
              </div>
              {bottlenecks > 0 && (
                <Badge className="mt-2 bg-rose-100 text-rose-700 border-0 text-[10px]">
                  <AlertOctagon className="w-3 h-3 ml-1" /> {faNumber(bottlenecks)} گلوگاه فعال
                </Badge>
              )}
              <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">پیشرفت مراحل: {faPercent(progress)}</p>
            </button>
          );
        })}
      </div>

      {/* جزئیات پروژه انتخابی */}
      {current && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold">{current.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{current.address}</p>
            </div>
            {can("projects.manage") && <AddPhaseDialog projectId={current.id} onDone={load} />}
          </div>

          {/* مراحل */}
          <CardBlock title="مراحل اجرا">
            <div className="flex flex-wrap gap-2">
              {current.phases.map((ph) => (
                <div key={ph.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                  <span className="text-xs font-medium">{ph.title}</span>
                  <StatusBadge status={ph.status} />
                </div>
              ))}
            </div>
          </CardBlock>

          {/* وظایف */}
          <CardBlock
            title="وظایف و تاییدیه‌های زنجیره‌ای"
            headerAction={can("tasks.manage") ? <AddTaskDialog projectId={current.id} contracts={current.contracts} persons={persons} onDone={load} /> : undefined}
          >
            {current.tasks.length === 0 ? (
              <EmptyState title="وظیفه‌ای ثبت نشده" />
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pl-1">
                {current.tasks.map((t) => (
                  <div key={t.id} className={`rounded-xl border p-2.5 ${t.isBottleneck && t.status !== "DONE" ? "border-rose-200 bg-rose-50/60" : ""}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-xs font-semibold">
                          {t.title} {t.isBottleneck && t.status !== "DONE" && <span className="text-rose-600">(گلوگاه بحرانی)</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          مسئول: {t.assigneePerson?.fullName || "—"} — موعد: {formatJalali(t.dueDate)}
                        </p>
                      </div>
                      <StatusBadge status={t.priority} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBlock>

          {/* قراردادها */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold">قراردادهای پروژه ({faNumber(current.contracts.length)})</h3>
              {can("contracts.manage") && (
                <CreateContractDialog projectId={current.id} persons={persons} onCreated={() => { load(); toast({ title: "قرارداد ثبت و پورسانت محاسبه شد" }); }} />
              )}
            </div>

            {current.contracts.map((c) => {
              const gate = gates[c.id];
              return (
                <Card key={c.id} className="overflow-hidden">
                  <div className="p-4 border-b bg-muted/40">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{c.title}</p>
                        <StatusBadge status={c.type} />
                        <StatusBadge status={c.status} />
                        {c.signingMode === "MULTI" && <Badge variant="outline" className="text-[10px]">چندقراردادی</Badge>}
                      </div>
                      <span className="text-sm font-bold text-emerald-700">{faMoneyShort(c.amount)} ریال</span>
                    </div>
                    {c.marketer && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        بازاریاب: {c.marketer.fullName}
                        {c.commissions && c.commissions[0] && ` — پورسانت ${faPercent(c.commissions[0].percent)} (${faMoneyShort(c.commissions[0].totalAmount)} ریال؛ سهم عقد ${faMoneyShort(c.commissions[0].signPart)})`}
                      </p>
                    )}
                  </div>

                  <div className="p-4">
                    <Tabs defaultValue="installments">
                      <TabsList className="mb-3 flex-wrap h-auto">
                        <TabsTrigger value="installments" className="text-xs">اقساط ({faNumber(c.installments.length)})</TabsTrigger>
                        {c.type === "WITH_MATERIALS" && <TabsTrigger value="materials" className="text-xs">مصالح و تراز</TabsTrigger>}
                        <TabsTrigger value="worklogs" className="text-xs">کارکردها ({faNumber(c.workLogs.length)})</TabsTrigger>
                        <TabsTrigger value="payouts" className="text-xs">تسویه‌ها ({faNumber(c.payouts.length)})</TabsTrigger>
                      </TabsList>

                      <TabsContent value="installments">
                        <div className="space-y-2">
                          {c.installments.map((i) => (
                            <div key={i.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5 flex-wrap">
                              <div>
                                <p className="text-xs font-medium">{i.title}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {faMoneyShort(i.amount)} ریال — سررسید {formatJalali(i.dueDate)}
                                  {i.escalationStage > 0 && i.status === "PENDING" && (
                                    <span className="text-amber-600"> — موتور پیگیری: مرحله {faNumber(i.escalationStage)}</span>
                                  )}
                                </p>
                              </div>
                              <StatusBadge status={i.status} />
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      {c.type === "WITH_MATERIALS" && (
                        <TabsContent value="materials">
                          {/* سد سخت */}
                          {gate && (
                            <div className={`rounded-xl border p-3 mb-3 ${gate.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
                              <div className="flex items-center gap-2">
                                {gate.passed ? (
                                  <Unlock className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Lock className="w-4 h-4 text-amber-600" />
                                )}
                                <p className="text-xs font-bold">سد سخت تراز مصالح (Hard Gate)</p>
                              </div>
                              <p className="text-[11px] mt-1.5 leading-5">{gate.message}</p>
                              {gate.missingItems.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {gate.missingItems.slice(0, 6).map((m, idx) => (
                                    <p key={idx} className="text-[11px] text-amber-700">• تراز ثبت‌نشده: {m.name}</p>
                                  ))}
                                  {gate.missingItems.length > 6 && (
                                    <p className="text-[11px] text-muted-foreground">و {faNumber(gate.missingItems.length - 6)} قلم دیگر…</p>
                                  )}
                                </div>
                              )}
                              {gate.shortageLines.length > 0 && (
                                <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 p-2">
                                  <p className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                                    <ShieldAlert className="w-3.5 h-3.5" /> کسری غیرمجاز — خودکار از دستمزد کسر می‌شود:
                                  </p>
                                  {gate.shortageLines.map((l, idx) => (
                                    <p key={idx} className="text-[11px] text-rose-600 mt-1">
                                      {l.itemName}: {faNumber(l.qty)} {l.unitPrice ? `× ${faMoneyShort(l.unitPrice)}` : ""} = {faMoneyShort(l.deduction)} ریال
                                    </p>
                                  ))}
                                  <p className="text-[11px] font-bold text-rose-700 mt-1.5">
                                    دستمزد {faMoneyShort(gate.wageTotal)} − کسری {faMoneyShort(gate.totalShortage)} = خالص {faMoneyShort(gate.netPayable)} ریال
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="space-y-2">
                            {c.materialItems.map((m) => {
                              const received = m.receipts.reduce((s, r) => s + r.qty, 0);
                              const balances = c.balances.filter((b) => b.materialItemId === m.id);
                              const consumed = balances.reduce((s, b) => s + b.consumedQty, 0);
                              return (
                                <div key={m.id} className="rounded-xl border p-2.5">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className="text-xs font-semibold">{m.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      برنامه: {faNumber(m.plannedQty)} {m.unit} — وصول: {faNumber(received)} — مصرف ثبت‌شده: {faNumber(consumed)}
                                    </p>
                                  </div>
                                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${m.plannedQty ? Math.min(100, (received / m.plannedQty) * 100) : 0}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </TabsContent>
                      )}

                      <TabsContent value="worklogs">
                        {c.workLogs.length === 0 ? (
                          <EmptyState title="کارکردی ثبت نشده" />
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto pl-1">
                            {c.workLogs.map((w) => (
                              <div key={w.id} className="rounded-xl border p-2.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">{w.description}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {formatJalali(w.date)} — {w.team?.name || w.person?.fullName || "—"}
                                      {w.phase && ` — مرحله: ${w.phase.title}`}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                      <StatusBadge status={w.tariffType} />
                                      {w.evidences.map((e) => (
                                        <Badge key={e.id} variant="outline" className="text-[9px]">{EVIDENCE_LABEL[e.kind] || e.kind}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="text-left shrink-0">
                                    <p className="text-xs font-bold text-emerald-700">{faMoneyShort(w.computedAmount)}</p>
                                    <div className="mt-1"><StatusBadge status={w.status} /></div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="payouts">
                        <PayoutSection contract={c} gate={gate} canRequest={can("approvals.request")} canPay={can("finance.manage")} onDone={load} />
                      </TabsContent>
                    </Tabs>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── بخش تسویه با اعمال سد سخت ──
function PayoutSection({ contract, gate, canRequest, canPay, onDone }: { contract: ContractRow; gate?: Gate; canRequest: boolean; canPay: boolean; onDone: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function requestPayout() {
    setBusy(true);
    try {
      await api("/api/payouts", {
        method: "POST",
        body: JSON.stringify({ contractId: contract.id, type: contract.type === "WITH_MATERIALS" ? "TEAM" : "TEAM" }),
      });
      toast({ title: "درخواست تسویه ثبت شد", description: "در انتظار تأیید مدیر در مرکز عملیات" });
      onDone();
    } catch (e) {
      toast({ title: "تسویه مسدود شد (سد سخت)", description: (e as Error).message, variant: "destructive", duration: 6000 });
    } finally {
      setBusy(false);
    }
  }

  async function payPayout(id: string) {
    setBusy(true);
    try {
      await api("/api/payouts", { method: "PATCH", body: JSON.stringify({ id }) });
      toast({ title: "تسویه پرداخت شد" });
      onDone();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const hardBlocked = gate && !gate.passed;

  return (
    <div className="space-y-3">
      {canRequest && (
        <Button
          size="sm"
          disabled={busy || !!hardBlocked}
          onClick={requestPayout}
          className={hardBlocked ? "bg-slate-300 text-slate-600 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}
        >
          <Lock className="w-3.5 h-3.5 ml-1" />
          {hardBlocked ? "تسویه قفل — تراز مصالح ناقص" : "درخواست تسویه اکیپ"}
        </Button>
      )}
      {contract.payouts.length === 0 ? (
        <p className="text-xs text-muted-foreground">تسویه‌ای ثبت نشده است.</p>
      ) : (
        contract.payouts.map((p) => (
          <div key={p.id} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-xs font-semibold">
                  تسویه {p.type === "TEAM" ? "اکیپ" : "سرپرست"} — {faMoneyShort(p.netAmount)} ریال
                </p>
                {p.blockReason && <p className="text-[11px] text-rose-600 mt-0.5">{p.blockReason}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                {canPay && p.status === "APPROVED" && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs" disabled={busy} onClick={() => payPayout(p.id)}>
                    پرداخت
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── دیالوگ ایجاد پروژه ──
function CreateProjectDialog({ persons, lines, onCreated }: { persons: PersonOpt[]; lines: LineOpt[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [employerId, setEmployerId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [serviceLineId, setServiceLineId] = useState("");
  const [budget, setBudget] = useState("");
  const [phases, setPhases] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name, code, address,
          employerId: employerId || null,
          supervisorId: supervisorId || null,
          serviceLineId: serviceLineId || null,
          budget: budget ? Number(budget) : null,
          phases: phases.map((p) => p.trim()).filter(Boolean),
        }),
      });
      setOpen(false);
      setName(""); setCode(""); setAddress(""); setBudget(""); setPhases([""]);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 ml-1" /> پروژه جدید
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderKanban className="w-5 h-5 text-emerald-600" /> ایجاد پروژه جدید</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>نام پروژه *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="برج مسکونی…" />
              </div>
              <div className="space-y-1.5">
                <Label>کد پروژه</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PRJ-1404-01" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>آدرس</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>کارفرما</Label>
                <Select value={employerId} onValueChange={setEmployerId}>
                  <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                  <SelectContent>
                    {persons.filter((p) => p.type === "EMPLOYER").map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>سرپرست/ناظر</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                  <SelectContent>
                    {persons.filter((p) => p.type === "SUPERVISOR").map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>رسته کاری</Label>
                <Select value={serviceLineId} onValueChange={setServiceLineId}>
                  <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                  <SelectContent>
                    {lines.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>بودجه (ریال)</Label>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} dir="ltr" inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>مراحل اجرا</Label>
              {phases.map((ph, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={ph}
                    onChange={(e) => setPhases(phases.map((p, j) => (j === i ? e.target.value : p)))}
                    placeholder={`مرحله ${faNumber(i + 1)}…`}
                  />
                  {phases.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => setPhases(phases.filter((_, j) => j !== i))} aria-label="حذف مرحله">
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setPhases([...phases, ""])}>
                <Plus className="w-3.5 h-3.5 ml-1" /> افزودن مرحله
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy || !name.trim()}>ثبت پروژه</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── دیالوگ ایجاد قرارداد ──
function CreateContractDialog({ projectId, persons, onCreated }: { projectId: string; persons: PersonOpt[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("WAGE");
  const [signingMode, setSigningMode] = useState("SINGLE");
  const [marketerId, setMarketerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ name: "", unit: "عدد", unitPrice: "", plannedQty: "" }]);
  const [installments, setInstallments] = useState([{ title: "پیش‌پرداخت", amount: "", dueDate: "" }]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (!title.trim() || !amount) return;
    setBusy(true);
    try {
      await api("/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          projectId, title, amount: Number(amount), type, signingMode,
          marketerId: marketerId || null, notes,
          materialItems: type === "WITH_MATERIALS"
            ? items.filter((i) => i.name && i.unitPrice).map((i) => ({ name: i.name, unit: i.unit, unitPrice: Number(i.unitPrice), plannedQty: Number(i.plannedQty) || 0 }))
            : [],
          installments: installments
            .filter((i) => i.amount && i.dueDate)
            .map((i) => ({ title: i.title, amount: Number(i.amount), dueDate: i.dueDate })),
        }),
      });
      setOpen(false);
      setTitle(""); setAmount(""); setNotes("");
      onCreated();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 ml-1" /> قرارداد جدید
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ایجاد قرارداد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>عنوان قرارداد *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>مبلغ کل (ریال) *</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" inputMode="numeric" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>نوع قرارداد</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WAGE">دستمزدی</SelectItem>
                    <SelectItem value="WITH_MATERIALS">بامصالح</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>حالت عقد</Label>
                <Select value={signingMode} onValueChange={setSigningMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SINGLE">تک‌قراردادی</SelectItem>
                    <SelectItem value="MULTI">چندقراردادی</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>بازاریاب</Label>
                <Select value={marketerId} onValueChange={setMarketerId}>
                  <SelectTrigger><SelectValue placeholder="بدون" /></SelectTrigger>
                  <SelectContent>
                    {persons.filter((p) => p.type === "MARKETER").map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {type === "WITH_MATERIALS" && (
              <div className="space-y-1.5 rounded-xl border p-3 bg-teal-50/40">
                <Label className="text-teal-800">اقلام مصالح (سد سخت تراز بر این اقلام اعمال می‌شود)</Label>
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-5" placeholder="نام قلم" value={it.name} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <Input className="col-span-2" placeholder="واحد" value={it.unit} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
                    <Input className="col-span-2" placeholder="قیمت واحد" dir="ltr" value={it.unitPrice} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} />
                    <Input className="col-span-2" placeholder="مقدار" dir="ltr" value={it.plannedQty} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, plannedQty: e.target.value } : x)))} />
                    <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="حذف">
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setItems([...items, { name: "", unit: "عدد", unitPrice: "", plannedQty: "" }])}>
                  <Plus className="w-3.5 h-3.5 ml-1" /> قلم جدید
                </Button>
              </div>
            )}
            <div className="space-y-1.5 rounded-xl border p-3 bg-muted/40">
              <Label>اقساط پرداخت کارفرما</Label>
              {installments.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-4" placeholder="عنوان قسط" value={it.title} onChange={(e) => setInstallments(installments.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input className="col-span-4" placeholder="مبلغ (ریال)" dir="ltr" value={it.amount} onChange={(e) => setInstallments(installments.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                  <Input className="col-span-3" placeholder="1404/06/01" dir="ltr" value={it.dueDate} onChange={(e) => setInstallments(installments.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setInstallments(installments.filter((_, j) => j !== i))} aria-label="حذف">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setInstallments([...installments, { title: "", amount: "", dueDate: "" }])}>
                <Plus className="w-3.5 h-3.5 ml-1" /> قسط جدید (تاریخ شمسی 1404/06/01)
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>یادداشت</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy}>ثبت قرارداد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── دیالوگ افزودن مرحله/وظیفه ──
function AddPhaseDialog({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}`, { method: "POST", body: JSON.stringify({ title }) });
      setOpen(false); setTitle(""); onDone();
    } finally { setBusy(false); }
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 ml-1" /> مرحله جدید</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader><DialogTitle>افزودن مرحله اجرا</DialogTitle></DialogHeader>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان مرحله…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy}>افزودن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddTaskDialog({ projectId, contracts, persons, onDone }: { projectId: string; contracts: ContractRow[]; persons: PersonOpt[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [contractId, setContractId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (!title.trim() || !dueDate) return;
    setBusy(true);
    try {
      const [jy, jm, jd] = dueDate.split("/").map(Number);
      const iso = gregorianToIso(jy, jm, jd);
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId, title, description,
          assigneePersonId: assignee || null,
          contractId: contractId || null,
          dueDate: iso, priority,
        }),
      });
      setOpen(false); setTitle(""); setDescription(""); setDueDate("");
      onDone();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 ml-1" /> وظیفه جدید</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader><DialogTitle>ایجاد وظیفه و تخصیص به سرپرست</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>عنوان *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>شرح</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>مسئول</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                  <SelectContent>
                    {persons.filter((p) => p.type === "SUPERVISOR").map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>اولویت</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">عادی</SelectItem>
                    <SelectItem value="HIGH">مهم</SelectItem>
                    <SelectItem value="CRITICAL">بحرانی</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {contracts.length > 0 && (
              <div className="space-y-1.5">
                <Label>قرارداد مرتبط</Label>
                <Select value={contractId} onValueChange={setContractId}>
                  <SelectTrigger><SelectValue placeholder="بدون قرارداد" /></SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>موعد (شمسی — مثل 1404/07/15) *</Label>
              <Input dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="1404/07/15" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy}>ایجاد وظیفه</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
