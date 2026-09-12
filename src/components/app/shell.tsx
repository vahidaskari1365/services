"use client";

import { useEffect, useState } from "react";
import { useApp } from "./store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { api } from "./store";
import { formatJalali } from "@/lib/jalali";
import { ThemeToggle } from "./theme-toggle";
import {
  Bell, Building2, ClipboardCheck, FolderKanban, LayoutDashboard, LogOut, Menu,
  Settings2, Users, Wallet, FileBarChart2, ListTodo, Inbox, Percent, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "داشبورد و BI", icon: LayoutDashboard, permission: "dashboard.view" },
  { key: "action", label: "مرکز عملیات", icon: ClipboardCheck, permission: "approvals.decide" },
  { key: "projects", label: "پروژه‌ها و قراردادها", icon: FolderKanban, permission: "projects.view" },
  { key: "people", label: "اشخاص و اکیپ‌ها", icon: Users, permission: "persons.view" },
  { key: "mytasks", label: "وظایف من", icon: ListTodo, permission: "tasks.own" },
  { key: "finance", label: "هاب مالی", icon: Wallet, permission: "finance.view" },
  { key: "secretary", label: "کارتابل پیگیری", icon: Inbox, permission: "escalations.view" },
  { key: "commissions", label: "پورسانت من", icon: Percent, permission: "commissions.view" },
  { key: "reports", label: "گزارش سود و زیان", icon: FileBarChart2, permission: "reports.pnl" },
  { key: "settings", label: "تنظیمات", icon: Settings2, permission: "settings.manage" },
];

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  sentAt: string;
}

function NotificationsBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const data = await api<{ notifications: NotificationItem[]; unread: number }>("/api/notifications?channel=IN_APP");
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function markRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    load();
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="اعلان‌ها">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -left-0.5 min-w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center px-1">
              {unread > 9 ? "+۹" : unread.toLocaleString("fa-IR")}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-semibold">اعلان‌ها</span>
          {unread > 0 && (
            <button onClick={markRead} className="text-xs text-emerald-600 hover:underline">
              علامت‌گذاری همه به‌عنوان خوانده‌شده
            </button>
          )}
        </div>
        <ScrollArea className="h-80">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">اعلانی وجود ندارد</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className={`px-3 py-2.5 border-b last:border-0 ${n.status === "SENT" ? "bg-emerald-500/10" : ""}`}>
                <p className="text-xs font-semibold">{n.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-5">{n.body}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{formatJalali(n.sentAt, true)}</p>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NavLinks({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  const { view, setView, can, user } = useApp();
  const items = NAV_ITEMS.filter((i) => can(i.permission));
  return (
    <nav className="space-y-1" aria-label="ناوبری اصلی">
      {items.map((item) => {
        const Icon = item.icon;
        const active = view === item.key;
        return (
          <button
            key={item.key}
            onClick={() => {
              setView(item.key);
              onNavigate?.();
            }}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            {!compact && <span>{item.label}</span>}
          </button>
        );
      })}
      {user && !compact && (
        <>
          <Separator className="my-3 bg-sidebar-border" />
          <div className="px-3 py-2">
            <Badge variant="outline" className="bg-transparent text-sidebar-foreground/60 border-sidebar-border text-[10px]">
              نقش: {user.roleName}
            </Badge>
          </div>
        </>
      )}
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, setView } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-row" dir="rtl">
      {/* سایدبار دسکتاپ */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <p className="font-extrabold text-sm">مپ‌پی‌ام‌اس</p>
            <p className="text-[10px] text-sidebar-foreground/60">{user.tenantName}</p>
          </div>
        </div>
        <ScrollArea className="flex-1 px-2 pb-4">
          <NavLinks />
        </ScrollArea>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user.fullName}</p>
              <p className="text-[10px] text-sidebar-foreground/60" dir="ltr">@{user.username}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={logout} aria-label="خروج">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* محتوای اصلی */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              {/* منوی موبایل */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 bg-sidebar text-sidebar-foreground p-0">
                  <SheetTitle className="sr-only">منوی ناوبری</SheetTitle>
                  <div className="flex items-center gap-2.5 px-4 py-5">
                    <Wrench className="w-5 h-5 text-emerald-300" />
                    <p className="font-extrabold text-sm">مپ‌پی‌ام‌اس</p>
                  </div>
                  <ScrollArea className="h-[calc(100vh-80px)] px-2 pb-4">
                    <NavLinks compact onNavigate={() => setMobileOpen(false)} />
                  </ScrollArea>
                </SheetContent>
              </Sheet>
              <div>
                <h1 className="text-sm sm:text-base font-bold">
                  {NAV_ITEMS.find((n) => n.key === useApp.getState().view)?.label || "مپ‌پی‌ام‌اس"}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <NotificationsBell />
              <Button variant="ghost" size="icon" className="lg:hidden text-muted-foreground" onClick={logout} aria-label="خروج">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-5 lg:p-6">{children}</main>
        <footer className="mt-auto border-t py-3 text-center text-[11px] text-muted-foreground">
          مپ‌پی‌ام‌اس — سامانه مدیریت پروژه و اتوماسیون تأسیسات ساختمانی · نسخه دمو
        </footer>
      </div>
    </div>
  );
}
