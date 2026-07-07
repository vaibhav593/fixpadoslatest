// FixPados Admin — API client.
// Storage keys are namespaced (`fp_admin_*`) so an admin session can never
// collide with a customer/worker session when both web apps are accessed
// from the same browser.

import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

const TOKEN_KEY = "fp_admin_token";
const USER_KEY = "fp_admin_user";

export type User = {
  id: string;
  name: string;
  mobile: string;
  role: "customer" | "worker" | "admin";
  photo?: string;
};

async function getToken(): Promise<string | null> {
  return await storage.getItem<string>(TOKEN_KEY, "");
}

export async function setToken(token: string) {
  await storage.setItem(TOKEN_KEY, token);
}

export async function setCachedUser(user: User) {
  await storage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getCachedUser(): Promise<User | null> {
  const raw = await storage.getItem<string>(USER_KEY, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await storage.removeItem(TOKEN_KEY);
  await storage.removeItem(USER_KEY);
}

async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const t = await getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail = JSON.parse(text).detail || text;
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as any;
  return (await res.json()) as T;
}

export const api = {
  // ─── Auth ───
  adminLogin: (password: string) =>
    request<{ token: string; user: User }>("/auth/admin-login", {
      method: "POST",
      body: { password },
      auth: false,
    }),
  me: () => request<User>("/auth/me"),

  // ─── Stats / Analytics ───
  adminStats: () => request<any>("/admin/stats"),
  adminAnalytics: () => request<any>("/admin/analytics"),

  // ─── Workers (verification) ───
  adminWorkers: (kyc?: string, search?: string) => {
    const params = new URLSearchParams();
    if (kyc) params.set("kyc_status", kyc);
    if (search) params.set("search", search);
    const qs = params.toString();
    return request<any[]>(`/admin/workers${qs ? `?${qs}` : ""}`);
  },
  approveWorker: (id: string) => request(`/admin/workers/${id}/approve`, { method: "POST" }),
  rejectWorker: (id: string, reason: string) =>
    request(`/admin/workers/${id}/reject`, { method: "POST", body: { reason } }),

  // ─── Catalog: Categories ───
  listCategories: (activeOnly = false) =>
    request<any[]>(`/categories?active_only=${activeOnly}`, { auth: false }),
  createCategory: (body: any) => request("/categories", { method: "POST", body }),
  updateCategory: (id: string, body: any) =>
    request(`/categories/${id}`, { method: "PATCH", body }),
  deleteCategory: (id: string) => request(`/categories/${id}`, { method: "DELETE" }),

  // ─── Catalog: Banners ───
  listBanners: () => request<any[]>("/banners"),
  createBanner: (body: any) => request("/banners", { method: "POST", body }),
  updateBanner: (id: string, body: any) =>
    request(`/banners/${id}`, { method: "PATCH", body }),
  deleteBanner: (id: string) => request(`/banners/${id}`, { method: "DELETE" }),

  // ─── Bookings (admin) ───
  adminBookings: (status?: string, schedule?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (schedule) q.set("schedule_type", schedule);
    const qs = q.toString();
    return request<any[]>(`/admin/bookings${qs ? `?${qs}` : ""}`);
  },
  adminAssignWorker: (bid: string, worker_id: string) =>
    request(`/admin/bookings/${bid}/assign-worker`, {
      method: "PATCH",
      body: { worker_id },
    }),
  adminChat: (bid: string) => request<any[]>(`/admin/chat/${bid}`),

  // Used by admin booking assignment picker.
  listWorkers: (categoryId?: string) =>
    request<any[]>(`/workers${categoryId ? `?category_id=${categoryId}` : ""}`, {
      auth: false,
    }),
};
