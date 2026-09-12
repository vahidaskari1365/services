"use client";

import { useState } from "react";
import { useApp } from "./store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, ShieldCheck } from "lucide-react";

const DEMO_ACCOUNTS = [
  { username: "manager", label: "مدیر", desc: "داشبورد BI و تأیید نهایی" },
  { username: "secretary", label: "منشی", desc: "کارتابل ارجاعات و تماس" },
  { username: "supervisor", label: "سرپرست کارگاه", desc: "وظایف موبایل و تراز مصالح" },
  { username: "accountant", label: "حسابدار", desc: "مالی و همگام‌سازی" },
  { username: "marketer", label: "بازاریاب", desc: "وضعیت پورسانت" },
  { username: "team", label: "اکیپ اجرایی", desc: "قرارداد و تسویه" },
];

export default function LoginView() {
  const login = useApp((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
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
            <CardDescription>حساب دمو را انتخاب کنید یا دستی وارد شوید</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                ورود
              </Button>
            </form>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground mb-2 text-center">ورود سریع با حساب‌های نمایشی (رمز همه: ۱۲۳۴)</p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.username}
                    type="button"
                    onClick={() => {
                      setUsername(a.username);
                      setPassword("1234");
                    }}
                    className="text-right rounded-xl border p-2.5 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                  >
                    <span className="block text-xs font-semibold">{a.label}</span>
                    <span className="block text-[10px] text-muted-foreground mt-0.5">{a.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
