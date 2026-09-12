"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useApp } from "../store";
import { CardBlock, EmptyState, SectionTitle, StatusBadge, LoadingCards, DueInfo } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { faMoneyShort, faNumber } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";
import { gregorianToIso } from "@/lib/jalali-client";
import { BadgeCheck, Plus, ShieldCheck, Trash2, Users } from "lucide-react";

interface PersonRow {
  id: string; type: string; fullName: string; phone: string; nationalId: string;
  address: string; marketerCode: string; notes: string; isActive: boolean;
  guaranteeChecks: CheckRow[];
  teamsLed: TeamRow[];
  memberships: { team: { name: string } }[];
  _count?: { projectsAsEmployer: number; projectsAsSupervisor: number; contractsAsMarketer: number };
}
interface CheckRow {
  id: string; checkNumber: string; amount: number; bankName: string; dueDate: string; status: string; notes: string;
}
interface TeamRow {
  id: string; name: string; isLocked: boolean; lockReason: string; notes: string;
  leader: { fullName: string } | null;
  serviceLine: { name: string } | null;
  members: { id: string; role: string; person: { fullName: string } }[];
  workLogs: { computedAmount: number }[];
}

const PERSON_TYPES = [
  { key: "EMPLOYER", label: "کارفرما" },
  { key: "TEAM_LEADER", label: "سرپرست اکیپ" },
  { key: "SUPERVISOR", label: "ناظر/سرپرست کارگاه" },
  { key: "MARKETER", label: "بازاریاب" },
  { key: "OTHER", label: "عضو اکیپ / سایر" },
];

export default function PeopleView() {
  const can = useApp((s) => s.can);
  const { toast } = useToast();
  const [persons, setPersons] = useState<PersonRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [checks, setChecks] = useState<(CheckRow & { person: { fullName: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("persons");

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([
        api<{ persons: PersonRow[] }>("/api/persons"),
        api<{ teams: TeamRow[]; checks: (CheckRow & { person: { fullName: string } })[] }>("/api/teams"),
      ]);
      setPersons(p.persons);
      setTeams(t.teams);
      setChecks(t.checks);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingCards count={6} />;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="اشخاص و اکیپ‌ها (CRM)"
        desc="ثبت و مدیریت طرف‌حساب‌ها — کارفرما، اکیپ اجرایی، بازاریاب و ناظر + چک ضمانت حسن انجام کار"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="persons" className="text-xs">اشخاص ({faNumber(persons.length)})</TabsTrigger>
          <TabsTrigger value="teams" className="text-xs">اکیپ‌های اجرایی ({faNumber(teams.length)})</TabsTrigger>
          <TabsTrigger value="checks" className="text-xs">چک‌های ضمانت ({faNumber(checks.length)})</TabsTrigger>
        </TabsList>

        <TabsContent value="persons" className="mt-4">
          {can("persons.manage") && <CreatePersonDialog onCreated={() => { load(); toast({ title: "شخص جدید ثبت شد" }); }} />}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-3">
            {persons.length === 0 && <EmptyState title="شخصی ثبت نشده" />}
            {persons.map((p) => (
              <div key={p.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm">{p.fullName}</p>
                  <StatusBadge status={p.type} />
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                  <p dir="ltr" className="text-right">{p.phone}</p>
                  {p.marketerCode && <p>کد بازاریاب: {p.marketerCode}</p>}
                  {p.address && <p>{p.address}</p>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {p.guaranteeChecks.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      <ShieldCheck className="w-3 h-3 ml-1" /> {faNumber(p.guaranteeChecks.length)} چک ضمانت
                    </Badge>
                  )}
                  {p._count && p._count.projectsAsEmployer > 0 && (
                    <Badge variant="outline" className="text-[10px]">{faNumber(p._count.projectsAsEmployer)} پروژه کارفرمایی</Badge>
                  )}
                  {p.teamsLed.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">سرپرست {p.teamsLed[0].name}</Badge>
                  )}
                  {!p.isActive && <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px]">غیرفعال</Badge>}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="mt-4">
          {can("teams.manage") && <CreateTeamDialog persons={persons} onCreated={() => { load(); toast({ title: "اکیپ ایجاد شد" }); }} />}
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            {teams.length === 0 && <EmptyState title="اکیپی ثبت نشده" />}
            {teams.map((t) => {
              const earned = t.workLogs.reduce((s, w) => s + w.computedAmount, 0);
              return (
                <div key={t.id} className={`rounded-2xl border bg-card p-4 ${t.isLocked ? "border-rose-300 bg-rose-50/40" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-600" /> {t.name}
                    </p>
                    {t.isLocked ? (
                      <Badge className="bg-rose-100 text-rose-700 border-0 text-[10px]">ارجاع پروژه جدید: قفل</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                        <BadgeCheck className="w-3 h-3 ml-1" /> فعال
                      </Badge>
                    )}
                  </div>
                  {t.isLocked && <p className="text-[11px] text-rose-600 mt-1">{t.lockReason}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    سرپرست: {t.leader?.fullName || "—"} {t.serviceLine && `— رسته: ${t.serviceLine.name}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    اعضا: {t.members.map((m) => m.person.fullName).join("، ")}
                  </p>
                  <p className="text-[11px] font-medium text-emerald-700 mt-1.5">
                    کارکرد تأییدشده تجمعی: {faMoneyShort(earned)} ریال
                  </p>
                  {t.notes && <p className="text-[11px] text-muted-foreground mt-1">{t.notes}</p>}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="checks" className="mt-4">
          {can("teams.manage") && (
            <CreateCheckDialog persons={persons.filter((p) => p.type === "TEAM_LEADER")} onCreated={() => { load(); toast({ title: "چک ضمانت ثبت شد" }); }} />
          )}
          <CardBlock title="پایش سررسید چک‌ها (موتور پیگیری: هشدار ۳۰ و ۱۵ روز قبل + قفل اکیپ پس از انقضا)">
            <div className="space-y-2">
              {checks.length === 0 && <EmptyState title="چکی ثبت نشده" />}
              {checks.map((c) => (
                <div key={c.id} className={`rounded-xl border p-3 ${c.status === "EXPIRED" ? "border-rose-300 bg-rose-50/50" : c.status === "EXPIRING_SOON" ? "border-amber-300 bg-amber-50/50" : ""}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold">
                        {c.person.fullName} — چک {c.checkNumber} ({c.bankName})
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        مبلغ: {faMoneyShort(c.amount)} ریال — سررسید: {formatJalali(c.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <DueInfo date={c.dueDate} />
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBlock>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreatePersonDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState("EMPLOYER");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [address, setAddress] = useState("");
  const [marketerCode, setMarketerCode] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (!fullName.trim()) return;
    setBusy(true);
    try {
      await api("/api/persons", {
        method: "POST",
        body: JSON.stringify({ fullName, type, phone, nationalId, address, marketerCode }),
      });
      setOpen(false);
      setFullName(""); setPhone(""); setNationalId(""); setAddress(""); setMarketerCode("");
      onCreated();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 ml-1" /> شخص جدید
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ثبت شخص جدید</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>نوع شخص</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERSON_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>نام و نام خانوادگی *</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>تلفن همراه</Label>
                <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09…" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>کد ملی</Label>
                <Input dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
              </div>
              {type === "MARKETER" && (
                <div className="space-y-1.5">
                  <Label>کد بازاریاب</Label>
                  <Input dir="ltr" value={marketerCode} onChange={(e) => setMarketerCode(e.target.value)} placeholder="MK-…" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>آدرس</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy}>ثبت</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateTeamDialog({ persons, onCreated }: { persons: PersonRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const leaders = persons.filter((p) => p.type === "TEAM_LEADER");

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api("/api/teams", {
        method: "POST",
        body: JSON.stringify({ name, leaderId: leaderId || null, memberIds: leaderId ? [...new Set([leaderId, ...memberIds])] : memberIds }),
      });
      setOpen(false); setName(""); setLeaderId(""); setMemberIds([]);
      onCreated();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 ml-1" /> اکیپ جدید
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ایجاد اکیپ اجرایی</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>نام اکیپ *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اکیپ …" />
            </div>
            <div className="space-y-1.5">
              <Label>سرپرست اکیپ</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                <SelectContent>
                  {leaders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>اعضا</Label>
              <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-xl border p-2">
                {persons.filter((p) => !leaders.includes(p)).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberIds.includes(p.id)}
                      onChange={(e) => setMemberIds(e.target.checked ? [...memberIds, p.id] : memberIds.filter((id) => id !== p.id))}
                      className="accent-emerald-600"
                    />
                    {p.fullName}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy}>ایجاد اکیپ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateCheckDialog({ persons, onCreated }: { persons: PersonRow[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function submit() {
    if (!personId || !checkNumber || !amount || !dueDate) return;
    setBusy(true);
    try {
      const [jy, jm, jd] = dueDate.split("/").map(Number);
      await api("/api/teams", {
        method: "POST",
        body: JSON.stringify({ kind: "check", personId, checkNumber, amount: Number(amount), bankName, dueDate: gregorianToIso(jy, jm, jd) }),
      });
      setOpen(false); setPersonId(""); setCheckNumber(""); setAmount(""); setBankName(""); setDueDate("");
      onCreated();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 ml-1" /> ثبت چک ضمانت
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>ثبت چک ضمانت حسن انجام کار</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>سرپرست اکیپ</Label>
              <Select value={personId} onValueChange={setPersonId}>
                <SelectTrigger><SelectValue placeholder="انتخاب…" /></SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>شماره چک *</Label>
                <Input dir="ltr" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>مبلغ (ریال) *</Label>
                <Input dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>بانک</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>سررسید (شمسی) *</Label>
                <Input dir="ltr" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="1405/03/01" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={busy}>ثبت چک</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
