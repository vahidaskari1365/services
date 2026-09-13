"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../store";
import { CardBlock, EmptyState, SectionTitle, LoadingCards } from "../shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { faMoneyShort, faNumber } from "@/lib/format";
import { Play, Plus, Save, Settings2, Trash2 } from "lucide-react";

interface SettingRow { id: string; key: string; value: string; group: string; label: string }
interface Tier { id: string; label: string; minAmount: number; maxAmount: number | null; percent: number; order: number }
interface Template { id: string; key: string; label: string; body: string; enabled: boolean }
interface RoleRow {
  id: string; key: string; name: string; description: string;
  permissions: { key: string; name: string; module: string }[];
  users: { id: string; fullName: string }[];
}
interface PermCatalog { key: string; name: string; module: string }
interface LineRow { id: string; name: string; code: string; isActive: boolean; _count?: { projects: number; teams: number } }

export default function SettingsView() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermCatalog[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLine, setNewLine] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        api<{ settings: SettingRow[]; tiers: Tier[]; templates: Template[]; roles: RoleRow[] }>("/api/settings"),
        api<{ lines: LineRow[] }>("/api/lines"),
      ]);
      setSettings(s.settings);
      setTiers(s.tiers);
      setTemplates(s.templates);
      setRoles(s.roles);
      setLines(l.lines);
      // کاتالوگ مجوزها از سمت کلاینت (ثابت)
      const { PERMISSION_CATALOG } = await import("@/lib/rbac");
      setPerms(PERMISSION_CATALOG);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveAll() {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          settings: settings.map((s) => ({ key: s.key, value: s.value })),
          tiers: tiers.map((t) => ({ label: t.label, minAmount: t.minAmount, maxAmount: t.maxAmount, percent: t.percent })),
          templates,
          rolePermissions: Object.fromEntries(roles.map((r) => [r.id, r.permissions.map((p) => p.key)])),
        }),
      });
      toast({ title: "تنظیمات ذخیره شد", description: "همه تغییرات فوراً روی موتورهای محاسباتی اعمال می‌شود" });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function runEngine() {
    setBusy(true);
    try {
      const data = await api<{ result: Record<string, number> }>("/api/cron", { method: "POST" });
      const r = data.result;
      toast({
        title: "موتور پیگیری اجرا شد",
        description: `پیامک اول: ${faNumber(r.sms1)} — پیامک دوم: ${faNumber(r.sms2)} — ارجاع قسط: ${faNumber(r.escalatedInstallments)} — وظیفه بحرانی: ${faNumber(r.criticalTasks)} — آلارم تراز: ${faNumber(r.balanceAlarms)} — هشدار چک: ${faNumber(r.checkWarnings)}`,
        duration: 7000,
      });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  if (loading) return <LoadingCards count={6} />;

  const escalationSettings = settings.filter((s) => s.group === "ESCALATION");
  const commissionSettings = settings.filter((s) => s.group === "COMMISSION");
  const generalSettings = settings.filter((s) => s.group === "GENERAL" || s.group === "FINANCE");

  function updateSetting(key: string, value: string) {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, value } : s)));
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="تنظیمات و گزارش‌ها"
        desc="هیچ فرمول، تعرفه یا متنی در کد سفت‌وسخت نشده — همه از این پنل به عنوان متغیر تعریف می‌شوند"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={runEngine} disabled={busy}>
              <Play className="w-4 h-4 ml-1" /> اجرای موتور پیگیری (Cron)
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={saveAll} disabled={busy}>
              <Save className="w-4 h-4 ml-1" /> ذخیره همه تغییرات
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="escalation">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="escalation" className="text-xs">آستانه‌های پیگیری</TabsTrigger>
          <TabsTrigger value="commission" className="text-xs">پلکان پورسانت</TabsTrigger>
          <TabsTrigger value="sms" className="text-xs">پترن‌های پیامک</TabsTrigger>
          <TabsTrigger value="lines" className="text-xs">رسته‌ها</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs">نقش‌ها و دسترسی (RBAC)</TabsTrigger>
          <TabsTrigger value="general" className="text-xs">عمومی</TabsTrigger>
        </TabsList>

        <TabsContent value="escalation" className="mt-4">
          <CardBlock title="آستانه‌های زمانی موتور پیگیری (Escalation Engine)">
            <div className="grid gap-3 sm:grid-cols-2">
              {escalationSettings.map((s) => (
                <div key={s.key} className="space-y-1.5">
                  <Label htmlFor={s.key} className="text-xs">{s.label}</Label>
                  <Input
                    id={s.key}
                    dir="ltr"
                    inputMode="numeric"
                    value={s.value}
                    onChange={(e) => updateSetting(s.key, e.target.value)}
                    className="max-w-24"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-5">
              منطق: قسط در سررسید پیامک اول ← بعد از «یادآور دوم» پیامک دوم ← بعد از «مهلت ارجاع» تسک تماس در کارتابل منشی.
              وظایف «هشدار موعد» ساعت قبل سررسید اعلان می‌گیرند و پس از «آستانه تاخیر» بحرانی و گلوگاه می‌شوند.
            </p>
          </CardBlock>
        </TabsContent>

        <TabsContent value="commission" className="mt-4 space-y-4">
          <CardBlock
            title="پلکان درصدی پورسانت (بر اساس مبلغ قرارداد)"
            headerAction={
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTiers([...tiers, { id: `new-${Date.now()}`, label: "", minAmount: 0, maxAmount: null, percent: 2, order: tiers.length + 1 }])}>
                <Plus className="w-3.5 h-3.5 ml-1" /> پله جدید
              </Button>
            }
          >
            <div className="space-y-2">
              {tiers.map((t, i) => (
                <div key={t.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                  <Input className="col-span-2 sm:col-span-4" placeholder="برچسب پله" value={t.label} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <Input className="col-span-1 sm:col-span-3" dir="ltr" placeholder="از مبلغ" value={t.minAmount} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minAmount: Number(e.target.value) || 0 } : x)))} />
                  <Input className="col-span-1 sm:col-span-3" dir="ltr" placeholder="تا مبلغ (خالی=بی‌نهایت)" value={t.maxAmount ?? ""} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, maxAmount: e.target.value === "" ? null : Number(e.target.value) } : x)))} />
                  <Input className="col-span-1 sm:col-span-1" dir="ltr" placeholder="٪" value={t.percent} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) || 0 } : x)))} />
                  <Button variant="ghost" size="icon" className="col-span-1 sm:col-span-1" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="حذف پله">
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>
          </CardBlock>
          <CardBlock title="پارامترهای تسویه پورسانت">
            <div className="grid gap-3 sm:grid-cols-2">
              {commissionSettings.map((s) => (
                <div key={s.key} className="space-y-1.5">
                  <Label className="text-xs">{s.label}</Label>
                  <Input dir="ltr" inputMode="numeric" value={s.value} onChange={(e) => updateSetting(s.key, e.target.value)} className="max-w-24" />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">الگوی پیش‌فرض سند: سهم عقد قرارداد ۵۰٪ + سهم وصول ۵۰٪ متناسب با وصول مطالبات کارفرما.</p>
          </CardBlock>
        </TabsContent>

        <TabsContent value="sms" className="mt-4">
          <CardBlock title="الگوی پیامک‌های پترن‌دار (مطابق استاندارد سرویس‌های خدماتی)">
            <div className="space-y-3">
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">{t.label}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{t.key}</span>
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={(v) => setTemplates(templates.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)))}
                        aria-label="فعال/غیرفعال"
                      />
                    </div>
                  </div>
                  <Textarea
                    rows={2}
                    value={t.body}
                    onChange={(e) => setTemplates(templates.map((x) => (x.id === t.id ? { ...x, body: e.target.value } : x)))}
                  />
                  <p className="text-[10px] text-muted-foreground">متغیرهای مجاز: {"{name} {amount} {project} {link} {date} {title} {contract}"}</p>
                </div>
              ))}
            </div>
          </CardBlock>
        </TabsContent>

        <TabsContent value="lines" className="mt-4">
          <CardBlock title="رسته‌های کاری (آب، گاز، برق، آتش‌نشانی، پلی‌اتیلن و رسته‌های آینده)">
            <div className="flex gap-2 mb-3">
              <Input placeholder="نام رسته جدید…" value={newLine} onChange={(e) => setNewLine(e.target.value)} className="max-w-56" />
              <Button
                size="sm"
                variant="outline"
                disabled={!newLine.trim()}
                onClick={async () => {
                  try {
                    await api("/api/lines", { method: "POST", body: JSON.stringify({ name: newLine.trim() }) });
                    setNewLine("");
                    toast({ title: "رسته اضافه شد" });
                    load();
                  } catch (e) {
                    toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
                  }
                }}
              >
                <Plus className="w-4 h-4 ml-1" /> افزودن
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {lines.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                  <Settings2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-medium">{l.name}</span>
                  {l.code && <Badge variant="outline" className="text-[9px]">{l.code}</Badge>}
                  {l._count && <span className="text-[10px] text-muted-foreground">{faNumber(l._count.projects)} پروژه</span>}
                </div>
              ))}
            </div>
          </CardBlock>
        </TabsContent>

        <TabsContent value="roles" className="mt-4 space-y-3">
          {roles.map((r) => (
            <CardBlock key={r.id} title={`${r.name} — ${r.description} (${faNumber(r.users.length)} کاربر)`}>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {perms.map((p) => {
                  const checked = r.permissions.some((rp) => rp.key === p.key);
                  return (
                    <label key={p.key} className="flex items-center gap-2 text-[11px] cursor-pointer rounded-lg border p-2 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setRoles((prev) =>
                            prev.map((role) =>
                              role.id === r.id
                                ? {
                                    ...role,
                                    permissions: e.target.checked
                                      ? [...role.permissions, p]
                                      : role.permissions.filter((rp) => rp.key !== p.key),
                                  }
                                : role
                            )
                          );
                        }}
                        className="accent-emerald-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-[9px] text-muted-foreground">{p.module}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </CardBlock>
          ))}
          <p className="text-[11px] text-muted-foreground">با ذخیره تغییرات، مجوزها در هر درخواست API سمت سرور اعتبارسنجی می‌شوند. افزودن نقش جدید (مثل «ناظر کیفی») بدون کدنویسی ممکن است.</p>
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <CardBlock title="تنظیمات عمومی و مالی">
            <div className="grid gap-3 sm:grid-cols-2">
              {generalSettings.map((s) => (
                <div key={s.key} className="space-y-1.5">
                  <Label className="text-xs">{s.label}</Label>
                  <Input value={s.value} onChange={(e) => updateSetting(s.key, e.target.value)} />
                </div>
              ))}
            </div>
          </CardBlock>
        </TabsContent>
      </Tabs>
    </div>
  );
}
