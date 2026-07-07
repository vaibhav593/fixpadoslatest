import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type User = {
  id: string;
  name: string;
  mobile: string;
  role: "customer" | "worker" | "admin";
  photo?: string;
  rating?: number;
  verified?: boolean;
  completed_jobs?: number;
  categories?: string[];
  available?: boolean;
};

async function getToken(): Promise<string | null> {
  return await storage.getItem<string>("hm_token", "");
}

export async function setToken(token: string) {
  await storage.setItem("hm_token", token);
}

export async function setCachedUser(user: User) {
  await storage.setItem("hm_user", JSON.stringify(user));
}

export async function getCachedUser(): Promise<User | null> {
  const raw = await storage.getItem<string>("hm_user", "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function clearSession() {
  await storage.removeItem("hm_token");
  await storage.removeItem("hm_user");
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
  register: (name: string, mobile: string, role: "customer" | "worker") =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { name, mobile, role },
      auth: false,
    }),
  adminLogin: (password: string) =>
    request<{ token: string; user: User }>("/auth/admin-login", {
      method: "POST",
      body: { password },
      auth: false,
    }),
  me: () => request<User>("/auth/me"),

  listCategories: (activeOnly = true) =>
    request<any[]>(`/categories?active_only=${activeOnly}`, { auth: false }),
  createCategory: (body: any) => request("/categories", { method: "POST", body }),
  updateCategory: (id: string, body: any) =>
    request(`/categories/${id}`, { method: "PATCH", body }),
  deleteCategory: (id: string) => request(`/categories/${id}`, { method: "DELETE" }),

  activeBanner: () => request<any>("/banners/active", { auth: false }),
  listBanners: () => request<any[]>("/banners"),
  createBanner: (body: any) => request("/banners", { method: "POST", body }),
  updateBanner: (id: string, body: any) => request(`/banners/${id}`, { method: "PATCH", body }),
  deleteBanner: (id: string) => request(`/banners/${id}`, { method: "DELETE" }),

  createBooking: (body: any) => request("/bookings", { method: "POST", body }),
  myBookings: () => request<any[]>("/bookings/me"),
  getBooking: (id: string) => request<any>(`/bookings/${id}`),
  cancelBooking: (id: string, reason: string) =>
    request(`/bookings/${id}/cancel`, { method: "PATCH", body: { reason } }),
  rejectJob: (id: string, reason: string) =>
    request(`/bookings/${id}/reject`, { method: "PATCH", body: { reason } }),
  acceptJob: (id: string) => request(`/bookings/${id}/accept`, { method: "PATCH" }),
  startJob: (id: string) => request(`/bookings/${id}/start`, { method: "PATCH" }),
  verifyPin: (id: string, pin: string) =>
    request(`/bookings/${id}/verify-pin`, { method: "POST", body: { pin } }),
  rateBooking: (id: string, stars: number, review: string) =>
    request(`/bookings/${id}/rate`, { method: "POST", body: { stars, review } }),

  workerJobs: () => request<any[]>("/worker/jobs"),
  workerEarnings: () => request<any>("/worker/earnings"),
  uploadKyc: (body: any) => request("/worker/upload-kyc", { method: "POST", body }),

  listMessages: (bid: string, since?: string) =>
    request<any[]>(`/chat/${bid}/messages${since ? `?since=${encodeURIComponent(since)}` : ""}`),
  sendMessage: (bid: string, text: string) =>
    request(`/chat/${bid}/messages`, { method: "POST", body: { text } }),

  notifications: () => request<any[]>("/notifications/me"),
  markRead: (nid: string) => request(`/notifications/${nid}/read`, { method: "PATCH" }),
  markAllRead: () => request(`/notifications/read-all`, { method: "POST" }),

  updateProfile: (body: any) => request("/profile", { method: "PATCH", body }),
  listAddresses: () => request<any[]>("/addresses"),
  addAddress: (body: any) => request("/addresses", { method: "POST", body }),
  delAddress: (id: string) => request(`/addresses/${id}`, { method: "DELETE" }),

  // Admin
  adminStats: () => request<any>("/admin/stats"),
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
  resubmitWorker: () => request<{ ok: boolean }>("/worker/resubmit", { method: "POST" }),
  adminBookings: (status?: string, schedule?: string) => {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (schedule) q.set("schedule_type", schedule);
    const qs = q.toString();
    return request<any[]>(`/admin/bookings${qs ? `?${qs}` : ""}`);
  },
  adminAssignWorker: (bid: string, worker_id: string) =>
    request(`/admin/bookings/${bid}/assign-worker`, { method: "PATCH", body: { worker_id } }),
  adminAnalytics: () => request<any>("/admin/analytics"),
  adminChat: (bid: string) => request<any[]>(`/admin/chat/${bid}`),
  // Service Areas
  checkServiceArea: (pincode: string) =>
    request<{ serviced: boolean; area?: any }>(
      `/service-areas/check?pincode=${encodeURIComponent(pincode)}`,
      { auth: false },
    ),
  adminServiceAreas: () => request<any[]>("/admin/service-areas"),
  adminServiceAreaStats: (id: string) =>
    request<{ customers: number; bookings: number; workers: number }>(
      `/admin/service-areas/${id}/stats`,
    ),
  adminCreateServiceArea: (body: {
    name: string;
    pincode: string;
    city: string;
    radius_km?: number | null;
    enabled: boolean;
  }) => request<any>("/admin/service-areas", { method: "POST", body }),
  adminUpdateServiceArea: (id: string, body: Partial<{
    name: string;
    pincode: string;
    city: string;
    radius_km: number | null;
    enabled: boolean;
  }>) => request<any>(`/admin/service-areas/${id}`, { method: "PATCH", body }),
  adminDeleteServiceArea: (id: string) =>
    request(`/admin/service-areas/${id}`, { method: "DELETE" }),
  listWorkers: (categoryId?: string) =>
    request<any[]>(`/workers${categoryId ? `?category_id=${categoryId}` : ""}`, { auth: false }),
};
