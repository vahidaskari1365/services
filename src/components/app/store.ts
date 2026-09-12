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
  logout: () => Promise<void>;
  setPayToken: (t: string | null) => void;
  can: (permission: string) => boolean;
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
      const res = await fetch("/api/auth/me");
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
      const data = await res.json();
      if (res.ok) {
        set({ user: data.user, view: data.user.defaultView || "dashboard" });
        return { ok: true };
      }
      return { ok: false, error: data.error };
    } catch {
      return { ok: false, error: "خطای اتصال به سرور" };
    }
  },
  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null, view: "dashboard" });
  },
  can: (permission) => {
    const u = get().user;
    return !!u && Array.isArray(u.permissions) && u.permissions.includes(permission);
  },
}));

export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "خطای سرور");
  return data as T;
}
