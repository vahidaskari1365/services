"use client";

// مدیریت کاربران — ایجاد کاربر، تغییر نقش، فعال/غیرفعال، بازنشانی رمز (مجوز: users.manage)
import { useCallback, useEffect, useState } from "react";
import { api, useApp } from "../store";
import { CardBlock, EmptyState, LoadingCards, SectionTitle } from "../shared";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";
import { formatJalali } from "@/lib/jalali";

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  personId: string | null;
  personName: string | null;
}
interface RoleRow { id: string; key: string; name: string; description: string }
interface PersonLite { id: string; fullName: string; type: string }

export default function UsersView() {
  const { user: me } = useApp();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [persons, setPersons] = useState<PersonLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwUser, setPwUser] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ users: UserRow[]; roles: RoleRow[] }>("/api/users");
      setUsers(data.users);
      setRoles(data.roles);
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
      setUsers([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
    api<{ persons: PersonLite[] }>("/api/persons")
      .then((d) => setPersons((d.persons || []).map((p) => ({ id: p.id, fullName: p.fullName, type: p.type }))))
      .catch(() => setPersons([]));
  }, [load]);

  async function patch(id: string, data: Record<string, unknown>, successMsg: string) {
    try {
      await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      toast({ title: successMsg });
      load();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="مدیریت کاربران"
        desc="ایجاد حساب کاربری، تعیین نقش و سطح دسترسی، فعال/غیرفعال‌سازی و بازنشانی رمز عبور"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="w-4 h-4" /> کاربر جدید
          </Button>
        }
      />

      {!users ? (
        <LoadingCards count={4} />
      ) : users.length === 0 ? (
        <EmptyState title="کاربری ثبت نشده است" />
      ) : (
        <CardBlock title={`کاربران سامانه (${users.length.toLocaleString("fa-IR")})`} headerAction={<Users className="w-4 h-4 text-muted-foreground" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-right py-2 px-2 font-medium">نام کامل</th>
                  <th className="text-right py-2 px-2 font-medium">نام کاربری</th>
                  <th className="text-right py-2 px-2 font-medium">نقش</th>
                  <th className="text-right py-2 px-2 font-medium">متصل به شخص</th>
                  <th className="text-right py-2 px-2 font-medium">تاریخ ایجاد</th>
                  <th className="text-center py-2 px-2 font-medium">فعال</th>
                  <th className="text-left py-2 px-2 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === me?.id;
                  return (
                    <tr key={u.id} className={`border-b last:border-0 ${u.isActive ? "" : "opacity-55"}`}>
                      <td className="py-2.5 px-2 font-medium whitespace-nowrap">
                        {u.fullName}
                        {isSelf && <Badge variant="outline" className="ms-2 text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">شما</Badge>}
                      </td>
                      <td className="py-2.5 px-2" dir="ltr">@{u.username}</td>
                      <td className="py-2.5 px-2">
                        {isSelf ? (
                          <Badge variant="outline" className="text-[10px]">{u.roleName}</Badge>
                        ) : (
                          <Select value={u.roleId} onValueChange={(v) => patch(u.id, { roleId: v }, "نقش کاربر تغییر کرد")}>
                            <SelectTrigger className="h-7 w-36 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {roles.map((r) => (
                                <SelectItem key={r.id} value={r.id} disabled={r.key === "MANAGER" && u.roleKey === "MANAGER"}>
                                  {r.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{u.personName || "—"}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{formatJalali(u.createdAt)}</td>
                      <td className="py-2.5 px-2 text-center">
                        <Switch
                          checked={u.isActive}
                          disabled={isSelf}
                          onCheckedChange={(v) => patch(u.id, { isActive: v }, v ? "کاربر فعال شد" : "کاربر غیرفعال شد")}
                          aria-label={`فعال‌سازی ${u.fullName}`}
                        />
                      </td>
                      <td className="py-2.5 px-2 text-left">
                        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setPwUser(u)}>
                          <KeyRound className="w-3.5 h-3.5" /> رمز
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBlock>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        persons={persons}
        onCreated={() => { setCreateOpen(false); load(); toast({ title: "کاربر جدید ایجاد شد" }); }}
      />

      <ResetPasswordDialog user={pwUser} onClose={() => setPwUser(null)} onSaved={() => { setPwUser(null); toast({ title: "رمز عبور بازنشانی شد" }); }} />

      <div className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-[11px] text-muted-foreground">
        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
        <p>
          نکته امنیتی: حداقل یک مدیر فعال همیشه باید در سامانه موجود باشد؛ سیستم اجازه نمی‌دهد آخرین مدیر فعال غیرفعال شود یا نقش او تغییر کند.
          رمزهای عبور به‌صورت رمزنگاری‌شده (scrypt) ذخیره می‌شوند و پس از بازنشانی، کاربر باید با رمز جدید وارد شود.
        </p>
      </div>
    </div>
  );
}

function CreateUserDialog({
  open, onOpenChange, roles, persons, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roles: RoleRow[];
  persons: PersonLite[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({ username: "", fullName: "", password: "", roleId: "", personId: "" });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({ ...form, personId: form.personId || null }),
      });
      setForm({ username: "", fullName: "", password: "", roleId: "", personId: "" });
      onCreated();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const valid = form.username.length >= 3 && form.fullName.length >= 3 && form.password.length >= 6 && form.roleId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ایجاد کاربر جدید</DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label>نام کامل</Label>
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="مثال: علی رضایی" />
          </div>
          <div className="space-y-1.5">
            <Label>نام کاربری (انگلیسی)</Label>
            <Input dir="ltr" className="text-left" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="ali.rezaei" />
          </div>
          <div className="space-y-1.5">
            <Label>رمز عبور (حداقل ۶ نویسه)</Label>
            <Input dir="ltr" className="text-left" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
          </div>
          <div className="space-y-1.5">
            <Label>نقش کاربر</Label>
            <Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
              <SelectTrigger><SelectValue placeholder="انتخاب نقش" /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="font-medium">{r.name}</span>
                    <span className="text-[10px] text-muted-foreground ms-2">— {r.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>اتصال به شخص (اختیاری — برای اکیپ/بازاریاب)</Label>
            <Select value={form.personId} onValueChange={(v) => setForm({ ...form, personId: v })}>
              <SelectTrigger><SelectValue placeholder="بدون اتصال" /></SelectTrigger>
              <SelectContent>
                {persons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button disabled={!valid || busy} onClick={submit}>{busy ? "در حال ثبت…" : "ایجاد کاربر"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose, onSaved }: { user: UserRow | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassword("");
  }, [user]);

  async function submit() {
    if (!user) return;
    setBusy(true);
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ password }) });
      onSaved();
    } catch (e) {
      toast({ title: "خطا", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>بازنشانی رمز عبور</AlertDialogTitle>
          <AlertDialogDescription>
            رمز جدید برای کاربر «{user?.fullName}» (@{user?.username}) تعیین کنید. رمز فعلی بلافاصله غیرمعتبر می‌شود.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input dir="ltr" className="text-left" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="رمز جدید (حداقل ۶ نویسه)" />
        <AlertDialogFooter>
          <AlertDialogCancel>انصراف</AlertDialogCancel>
          <AlertDialogAction disabled={password.length < 6 || busy} onClick={(e) => { e.preventDefault(); submit(); }}>
            {busy ? "در حال ثبت…" : "ثبت رمز جدید"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
