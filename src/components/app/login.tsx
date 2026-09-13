"use client";

import { useState } from "react";
import { useApp } from "./store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, ShieldCheck, Zap } from "lucide-react";

const DEMO_ROLES = [
  { roleKey: "MANAGER", label: "مدیر", desc: "داشبورد BI و تأیید نهایی" },
  { roleKey: "SECRETARY", label: "منشی", desc: "کارتابل ارجاعات و تماس" },
  { roleKey: "SUPERVISOR", label: "سرپرست کارگاه", desc: "وظایف موبایل و تراز مصالح" },
  { roleKey: "ACCOUNTANT", label: "حسابدار", desc: "مالی و همگام‌سازی" },
  { roleKey: "MARKETER", label: "بازاریاب", desc: "وضعیت پورسانت" },
  { roleKey: "TEAM", label: "اکیپ اجرایی", desc: "قرارداد و تسویه" },
];

export default function LoginView() {
  const login = useApp((s) => s.login);
  const demoLogin = useApp((s) => s.demoLogin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoRole, setDemoRole] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (!res.ok) setError(res.error || "خطا");
  }

  async function handleDemo(roleKey: string) {
    setError("");
    setDemoRole(roleKey);
    const res = await demoLogin(roleKey);
    setDemoRole("");
    if (!res.ok) setError(res.error || "خطا");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-emerald-950 via-emerald-900 to-teal-900 p-4">
      <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-6 items-stretch">
        {/* برند */}
        <div className="hidden lg:flex flex-col justify-between p-8 text-emerald-50">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold">مپ‌پی‌ام‌اس</h1>
                <p className="text-xs text-emerald-300/80">MEP-PMS v1.0</p>
              </div>
            </div>
            <h2 className="text-xl font-bold leading-relaxed mb-3">
              سامانه مدیریت پروژه و اتوماسیون تأسیسات ساختمانی
            </h2>
            <p className="text-sm text-emerald-200/70 leading-7">
              چرخه کامل عملیات پیمانکاری — از ثبت قرارداد تا تسویه اکیپ‌ها؛ با سد سخت تراز مصالح،
              موتور تعرفه سرپرستان، پورسانت پلکانی بازاریابان و پیگیری خودکار اقساط و وظایف.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              "مرکز عملیات با تأیید یک‌کلیکی",
              "سد سخت تراز مصالح (Hard Gate)",
              "موتور پیگیری و ارجاع خودکار",
              "هاب مالی و لینک پرداخت آنلاین",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-400/20 px-3 py-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-300" />
                <span className="text-emerald-100/90">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* فرم ورود */}
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-bold">ورود به سامانه</CardTitle>
            <CardDescription>فقط نقش را انتخاب کنید — بدون رمز وارد شوید</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <Zap className="w-4 h-4" />
              <span className="text-sm font-bold">ورود فوری نمایشی (بدون رمز)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ROLES.map((a) => (
                <button
                  key={a.roleKey}
                  type="button"
                  disabled={demoRole !== ""}
                  onClick={() => handleDemo(a.roleKey)}
                  className="text-right rounded-xl border p-2.5 hover:border-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-60"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{a.label}</span>
                    {demoRole === a.roleKey && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
                  </span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">{a.desc}</span>
                </button>
              ))}
            </div>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] text-muted-foreground">ورود دستی با نام کاربری و رمز</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="username">نام کاربری</Label>
                  <Input
                    id="username"
                    dir="ltr"
                    className="text-left"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="manager"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">رمز عبور</Label>
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    className="text-left"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="1234"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>}
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                ورود
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
