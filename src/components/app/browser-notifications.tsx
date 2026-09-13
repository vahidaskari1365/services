"use client";

// اعلان مرورگر — فعال‌سازی مجوز Notification، دکمه وضعیت در هدر و پل اعلان‌های درون‌برنامه‌ای
// اعلان‌های جدید (خوانده‌نشده) هر ۴۵ ثانیه به اعلان سیستمی مرورگر تبدیل می‌شوند
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "./store";
import { Bell, BellOff, BellRing } from "lucide-react";

const ENABLED_KEY = "mep_browser_notif_enabled";
const LAST_SEEN_KEY = "mep_last_notif_at";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  status: string;
  sentAt: string;
}

function supported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export default function BrowserNotifications() {
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [enabled, setEnabled] = useState(false);
  const firingRef = useRef(false);

  useEffect(() => {
    if (!supported()) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    setEnabled(localStorage.getItem(ENABLED_KEY) === "1");
    // ثبت سرویس‌ورکر برای پشتیبانی اندروید (fallback)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {/* بی‌اهمیت */});
    }
  }, []);

  // پل: تبدیل اعلان‌های خوانده‌نشده جدید به اعلان مرورگر
  useEffect(() => {
    if (permission !== "granted" || !enabled) return;
    let alive = true;

    async function poll() {
      if (firingRef.current || !alive) return;
      firingRef.current = true;
      try {
        const data = await api<{ notifications: NotificationItem[] }>("/api/notifications?channel=IN_APP");
        const items = (data.notifications || []).filter((n) => n.status === "SENT");
        const lastSeen = localStorage.getItem(LAST_SEEN_KEY) || "";
        const fresh = items.filter((n) => n.sentAt > lastSeen).slice(0, 3);
        if (items[0]) localStorage.setItem(LAST_SEEN_KEY, items[0].sentAt);
        if (lastSeen === "") return; // اولین اجرا — فقط مبنا ثبت شود تا انبوه اعلان قدیمی نیاید
        for (const n of fresh) {
          fireNotification(n.title, n.body, n.id);
        }
      } catch {
        /* بی‌اهمیت */
      } finally {
        firingRef.current = false;
      }
    }

    poll();
    const t = setInterval(poll, 45000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [permission, enabled]);

  const fireNotification = useCallback((title: string, body: string, tag?: string) => {
    try {
      const n = new Notification(title, { body, icon: "/logo.svg", tag, dir: "rtl", lang: "fa" });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // اندروید کروم — از سرویس‌ورکر
      navigator.serviceWorker?.ready
        .then((reg) => reg.showNotification(title, { body, icon: "/logo.svg", tag, dir: "rtl", lang: "fa" }))
        .catch(() => {});
    }
  }, []);

  function handleClick() {
    if (!supported()) {
      toast({ title: "پشتیبانی نمی‌شود", description: "مرورگر شما از اعلان پشتیبانی نمی‌کند", variant: "destructive" });
      return;
    }
    if (Notification.permission === "denied") {
      toast({
        title: "اعلان مسدود است",
        description: "در تنظیمات مرورگر، اعلان این سایت را مجاز کنید",
        variant: "destructive",
      });
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        setPermission(p);
        if (p === "granted") {
          localStorage.setItem(ENABLED_KEY, "1");
          setEnabled(true);
          fireNotification("اعلان‌ها فعال شد ✓", "از این پس هشدارهای سامانه را همین‌جا دریافت می‌کنید");
          toast({ title: "اعلان مرورگر فعال شد" });
        }
      });
      return;
    }
    // granted — روشن/خاموش
    const next = !enabled;
    localStorage.setItem(ENABLED_KEY, next ? "1" : "0");
    setEnabled(next);
    if (next) {
      fireNotification("اعلان‌ها روشن شد ✓", "نمونه اعلان — اقساط و وظایف را از دست نمی‌دهید");
      toast({ title: "اعلان مرورگر روشن شد" });
    } else {
      toast({ title: "اعلان مرورگر خاموش شد" });
    }
  }

  const label = permission === "unsupported" ? "اعلان مرورگر پشتیبانی نمی‌شود" : enabled ? "اعلان مرورگر: روشن" : "اعلان مرورگر: خاموش";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`relative ${enabled ? "text-emerald-600" : "text-muted-foreground"}`}
    >
      {enabled ? <BellRing className="w-5 h-5" /> : permission === "denied" ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
      {permission === "default" && !enabled && (
        <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
      )}
    </Button>
  );
}
