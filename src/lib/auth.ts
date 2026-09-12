import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

const SECRET = process.env.AUTH_SECRET || "mep-pms-dev-secret-key-2025";
export const SESSION_COOKIE = "mep_session";

export interface SessionUser {
  userId: string;
  tenantId: string;
  username: string;
  roleKey: string;
  roleName: string;
  personId?: string | null;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createToken(session: SessionUser): string {
  const payload = Buffer.from(JSON.stringify({ ...session, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.userId || !data.tenantId) return null;
    return data as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const fromCookie = store.get(SESSION_COOKIE)?.value;
  if (fromCookie) return parseToken(fromCookie);
  // فال‌بک هدر توکن — برای محیط‌هایی که کوکی بلاک می‌شود (مثل iframe پیش‌نمایش چت)
  try {
    const h = await headers();
    return parseToken(h.get("x-session-token") || undefined);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("احراز هویت لازم است", 401);
  const user = await db.user.findUnique({ where: { id: session.userId }, include: { role: true } });
  if (!user || !user.isActive) throw new AuthError("کاربر غیرفعال است", 403);
  return session;
}

// session با personId کامل (برای فیلتر «وظایف من» و کارکردها)
export async function getFullSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("احراز هویت لازم است", 401);
  if (session.personId) return session;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) throw new AuthError("کاربر غیرفعال است", 403);
  return { ...session, personId: user.personId };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
