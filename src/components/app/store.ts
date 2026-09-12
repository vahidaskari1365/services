"use client";

import { create } from "zustand";

export interface UserInfo {
  id: string;
  username: string;
  fullName: string;
  roleKey: string;
  roleName: string;
  tenantName?: string;
  tenantId?: string;
  personId?: string | null;
  permissions: string[];
  defaultView?: string;
}

interface AppState {
  user: UserInfo | null;
  authLoading: boolean;
  view: string;
  payToken: string | null; // لینک پرداخت باز شده (?pay=token)
  setView: (v: string) => void;
  setUser: (u: UserInfo | null) => void;
  loadUser: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  demoLogin: (roleKey: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  setPayToken: (t: string | null) => void;
  can: (permission: string) => boolean;
}

// توکن در localStorage — برای محیط‌هایی که کوکی بلاک می‌شود (iframe پیش‌نمایش چت)
const TOKEN_KEY = "mep_token";

export function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = window.localStorage.getItem(TOKEN_KEY);
  return t ? { "x-session-token": t } : {};
}

function saveToken(token?: string) {
  if (typeof window !== "undefined" && token) window.localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  if (typeof window !== "undefined") window.localStorage.removeItem(TOKEN_KEY);
}

interface AuthResponse {
  ok: boolean;
  token?: string;
  user?: UserInfo;
  error?: string;
}

export const useApp = create<AppState>((set, get) => ({
  user: null,
  authLoading: true,
  view: "dashboard",
  payToken: null,
  setView: (v) => set({ view: v }),
  setUser: (u) => set({ user: u }),
  setPayToken: (t) => set({ payToken: t }),
  loadUser: async () => {
    try {
      const res = await fetch("/api/auth/me", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, authLoading: false, view: data.user.defaultView || "dashboard" });
      } else {
        set({ user: null, authLoading: false });
      }
    } catch {
      set({ user: null, authLoading: false });
    }
  },
  login: async (username, password) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data: AuthResponse = await res.json();
      if (res.ok && data.user) {
        saveToken(data.token);
        set({ user: data.user, view: data.user.defaultView || "dashboard" });
        return { ok: true };
      }
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: "خطای اتصال به سرور" };
    }
  },
  demoLogin: async (roleKey) => {
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleKey }),
      });
      const data: AuthResponse = await res.json();
      if (res.ok && data.user) {
        saveToken(data.token);
        set({ user: data.user, view: data.user.defaultView || "dashboard" });
        return { ok: true };
      }
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: "خطای اتصال به سرور" };
    }
  },
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() });
    clearToken();
    set({ user: null, view: "dashboard" });
  },
  can: (permission) => {
    const u = get().user;
    return !!u && Array.isArray(u.permissions) && u.permissions.includes(permission);
  },
}));

export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطای سرور");
  return data as T;
}
