import { notifyAdminActivityRefresh } from "@/lib/admin-activity-bus";

/**
 * Côté navigateur : URL publique (NEXT_PUBLIC_*).
 * Côté serveur (SSR Docker) : préférer API_INTERNAL_URL (ex. http://api:3001)
 * pour éviter le hairpin NAT vers api.opt1mum.com.
 */
const API_URL =
  (typeof window === "undefined"
    ? process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? "http://localhost:3001";

/** Après une mutation admin réussie, le rail d’activités se rafraîchit. */
function maybeNotifyAdminActivity(path: string, method?: string) {
  const m = (method ?? "GET").toUpperCase();
  if (m === "GET" || m === "HEAD") return;
  if (path.startsWith("/admin/activity")) return;
  if (
    path === "/auth/admin/login" ||
    path === "/auth/admin/logout" ||
    path === "/auth/admin/refresh"
  ) {
    return;
  }
  if (path.startsWith("/admin/") || path.startsWith("/auth/admin/")) {
    notifyAdminActivityRefresh();
  }
}

export type Subscriber = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  address: string | null;
  subscriberCode: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type AdminStaffMember = AdminUser & {
  isActive: boolean;
  updatedAt: string;
  avatarUrl: string | null;
};

export type AdminStaffSummary = {
  total: number;
  active: number;
  suspended: number;
};

export type AdminStaffListResponse = {
  items: AdminStaffMember[];
  total: number;
  take: number;
  skip: number;
  summary: AdminStaffSummary;
};

export const ADMIN_ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "EDITOR",
  "REDACTEUR",
] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

type ApiErrorBody = {
  message?: string | string[];
  statusCode?: number;
};

type ApiFetchInit = RequestInit & { __retried?: boolean };

/** Évite une boucle de refresh concurrente. */
let adminRefreshInFlight: Promise<boolean> | null = null;
let subscriberRefreshInFlight: Promise<boolean> | null = null;

function isAuthRefreshExempt(path: string): boolean {
  return (
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/refresh" ||
    path === "/auth/logout" ||
    path === "/auth/google" ||
    path === "/auth/forgot-password" ||
    path === "/auth/reset-password" ||
    path === "/auth/verify-email" ||
    path === "/auth/admin/login" ||
    path === "/auth/admin/refresh" ||
    path === "/auth/admin/logout" ||
    path.startsWith("/auth/request-") ||
    path.startsWith("/auth/confirm-")
  );
}

function isAdminApiPath(path: string): boolean {
  return path.startsWith("/admin/") || path.startsWith("/auth/admin/");
}

async function rawRefresh(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function refreshAdminSession(): Promise<boolean> {
  if (!adminRefreshInFlight) {
    adminRefreshInFlight = rawRefresh("/auth/admin/refresh").finally(() => {
      adminRefreshInFlight = null;
    });
  }
  return adminRefreshInFlight;
}

function refreshSubscriberSession(): Promise<boolean> {
  if (!subscriberRefreshInFlight) {
    subscriberRefreshInFlight = rawRefresh("/auth/refresh").finally(() => {
      subscriberRefreshInFlight = null;
    });
  }
  return subscriberRefreshInFlight;
}

async function parseApiError(res: Response): Promise<string> {
  let message = "Une erreur est survenue";
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) {
      message = body.message.join(", ");
    } else if (typeof body.message === "string") {
      message = body.message;
    } else if (res.status === 401) {
      message = "Session expirée — reconnectez-vous";
    }
  } catch {
    if (res.status === 401) {
      message = "Session expirée — reconnectez-vous";
    }
  }
  return message;
}

async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const retried = Boolean(init?.__retried);
  const { __retried: _, ...fetchInit } = init ?? {};
  const hasExplicitCache =
    fetchInit.cache != null ||
    (fetchInit as RequestInit & { next?: unknown }).next != null;

  const res = await fetch(`${API_URL}/api${path}`, {
    ...fetchInit,
    // SSR : ne pas garder un HTML figé avec le fallback démo
    ...(typeof window === "undefined" && !hasExplicitCache
      ? { cache: "no-store" as RequestCache }
      : {}),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(fetchInit.headers ?? {}),
    },
  });

  if (
    res.status === 401 &&
    !retried &&
    !isAuthRefreshExempt(path)
  ) {
    const refreshed = isAdminApiPath(path)
      ? await refreshAdminSession()
      : await refreshSubscriberSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...fetchInit, __retried: true });
    }
  }

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  maybeNotifyAdminActivity(path, fetchInit.method);

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

async function apiFetchForm<T>(
  path: string,
  body: FormData,
  retried = false,
): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "POST",
    credentials: "include",
    body,
  });

  if (res.status === 401 && !retried && !isAuthRefreshExempt(path)) {
    const refreshed = isAdminApiPath(path)
      ? await refreshAdminSession()
      : await refreshSubscriberSession();
    if (refreshed) {
      return apiFetchForm<T>(path, body, true);
    }
  }

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  maybeNotifyAdminActivity(path, "POST");

  return res.json() as Promise<T>;
}

export const authApi = {
  register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    turnstileToken?: string;
  }) {
    return apiFetch<Subscriber>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: {
    email: string;
    password: string;
    turnstileToken?: string;
  }) {
    return apiFetch<Subscriber>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  loginWithGoogle(credential: string, turnstileToken?: string) {
    return apiFetch<Subscriber>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, turnstileToken }),
    });
  },

  me() {
    return apiFetch<Subscriber>("/auth/me");
  },

  updateProfile(input: {
    name: string;
    email: string;
    phone?: string;
    country?: string;
    countryCode?: string;
    address?: string;
  }) {
    return apiFetch<Subscriber>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadAvatar(file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<Subscriber>("/auth/me/avatar", body);
  },

  changePassword(input: { currentPassword: string; newPassword: string }) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/me/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  refresh() {
    return apiFetch<Subscriber>("/auth/refresh", { method: "POST" });
  },

  logout() {
    return apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
  },

  verifyEmail(token: string) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  resendVerification() {
    return apiFetch<{ ok: boolean; message: string }>(
      "/auth/resend-verification",
      { method: "POST" },
    );
  },

  forgotPassword(email: string, turnstileToken?: string) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, turnstileToken }),
    });
  },

  resetPassword(email: string, otp: string, password: string) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, password }),
    });
  },
};

export type LibraryMagazine = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt?: string | null;
  readPath: string | null;
};

export type LibraryResponse = {
  status: "active" | "expired" | "pending" | "none";
  expiresAt: string | null;
  planName?: string | null;
  magazines: LibraryMagazine[];
};

export const libraryApi = {
  me() {
    return apiFetch<LibraryResponse>("/library/me");
  },

  notifications(params?: {
    days?: number;
    q?: string;
    type?: string;
    unreadOnly?: boolean;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.days != null) qs.set("days", String(params.days));
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.type) qs.set("type", params.type);
    if (params?.unreadOnly) qs.set("unread", "1");
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<NotificationsResponse>(`/library/notifications${suffix}`);
  },

  notificationsUnreadCount(days = 3) {
    return apiFetch<NotificationsUnreadResponse>(
      `/library/notifications/unread-count?days=${days}`,
    );
  },

  markNotificationRead(notificationId: string) {
    return apiFetch<NotificationReadResponse>("/library/notifications/read", {
      method: "POST",
      body: JSON.stringify({ notificationId }),
    });
  },

  markNotificationsSeen(days = 3) {
    return apiFetch<NotificationsSeenResponse>(
      `/library/notifications/seen?days=${days}`,
      { method: "POST" },
    );
  },

  payments(params?: {
    take?: number;
    skip?: number;
    q?: string;
    status?: string;
    provider?: string;
    purpose?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.purpose) qs.set("purpose", params.purpose);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<PaymentsHistoryResponse>(`/library/payments${suffix}`);
  },

  purchases() {
    return apiFetch<PurchasesHistoryResponse>("/library/purchases");
  },
};

export type NotificationKind =
  | "ARTICLE"
  | "MAGAZINE"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_EXPIRING"
  | "PURCHASE_READY";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string;
  coverUrl: string | null;
  createdAt: string;
  unread: boolean;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  total: number;
  take: number;
  skip: number;
  days: number;
  unreadCount: number;
  unreadOnly: boolean;
};

export type NotificationsUnreadResponse = {
  unreadCount: number;
  days: number;
};

export type NotificationsSeenResponse = {
  seenAt: string;
  unreadCount: number;
};

export type NotificationReadResponse = {
  ok: boolean;
  notificationId?: string;
  unreadCount: number;
};

export type PaymentHistoryItem = {
  id: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  purpose: string;
  providerRef: string | null;
  planName?: string | null;
  magazineTitle?: string | null;
  magazineIssue?: string | null;
  metadata?: Record<string, unknown> | null;
  label: string;
  createdAt: string;
  updatedAt?: string;
};

export type PaymentsHistoryResponse = {
  payments: PaymentHistoryItem[];
  total: number;
  take: number;
  skip: number;
};

export type PurchaseHistoryItem = {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  magazine: {
    id: string;
    title: string;
    issueNumber: string | null;
    coverUrl: string | null;
    publishedAt: string | null;
    readPath: string | null;
  };
};

export type PurchasesHistoryResponse = {
  purchases: PurchaseHistoryItem[];
};

export const adminAuthApi = {
  login(input: {
    email: string;
    password: string;
    turnstileToken?: string;
  }) {
    return apiFetch<AdminUser>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me() {
    return apiFetch<AdminUser>("/auth/admin/me");
  },

  refresh() {
    return apiFetch<AdminUser>("/auth/admin/refresh", { method: "POST" });
  },

  logout() {
    return apiFetch<{ ok: boolean }>("/auth/admin/logout", { method: "POST" });
  },

  updateProfile(input: { name: string; title?: string; phone?: string }) {
    return apiFetch<AdminUser>("/auth/admin/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  changePassword(input: { currentPassword: string; newPassword: string }) {
    return apiFetch<{ ok: boolean }>("/auth/admin/me/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  uploadAvatar(file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminUser>("/auth/admin/me/avatar", body);
  },
};

export const adminStaffApi = {
  list(params?: {
    q?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.active) qs.set("active", params.active);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminStaffListResponse>(`/admin/staff${suffix}`);
  },

  create(input: {
    email: string;
    name: string;
    password: string;
    role: AdminRoleName;
    title?: string;
  }) {
    return apiFetch<AdminStaffMember>("/admin/staff", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(
    id: string,
    input: {
      name?: string;
      role?: AdminRoleName;
      title?: string;
      isActive?: boolean;
      password?: string;
    },
  ) {
    return apiFetch<AdminStaffMember>(`/admin/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type AdminDashboardStats = {
  subscribersCount: number;
  magazinesCount: number;
  publishedMagazines: number;
  activeSubscriptions: number;
  successPayments: number;
  pendingPayments: number;
  articlesCount: number;
  volumePaidCents: number;
  volume14Cents: number;
  payments14Count: number;
  charts: {
    volumeByDay: Array<{ date: string; volumeCents: number; count: number }>;
    purposeBreakdown: Array<{
      purpose: string;
      count: number;
      volumeCents: number;
    }>;
  };
  recentPayments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    purpose: string;
    provider: string;
    providerRef: string | null;
    createdAt: string;
    subscriberName: string;
    subscriberEmail: string;
  }>;
  recentSubscribers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    isActive: boolean;
  }>;
};

export const adminDashboardApi = {
  stats() {
    return apiFetch<AdminDashboardStats>("/admin/stats");
  },
};

export type AdminActivityActorType = "ADMIN" | "SUBSCRIBER" | "SYSTEM";

export type AdminActivityItem = {
  id: string;
  actorType: AdminActivityActorType;
  action: string;
  actionLabel: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
  admin?: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  } | null;
  subscriber?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type AdminActivityListResponse = {
  items: AdminActivityItem[];
  total: number;
  take: number;
  skip: number;
};

export const adminActivityApi = {
  list(params?: {
    take?: number;
    skip?: number;
    q?: string;
    actorType?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.actorType) qs.set("actorType", params.actorType);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminActivityListResponse>(`/admin/activity${suffix}`);
  },

  recent(take = 8) {
    return apiFetch<{ items: AdminActivityItem[] }>(
      `/admin/activity/recent?take=${take}`,
    );
  },

  get(id: string) {
    return apiFetch<AdminActivityItem>(`/admin/activity/${id}`);
  },
};

export type SubscriptionStatusName = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type PaymentStatusName =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type AdminSubscription = {
  id: string;
  legacyId: number | null;
  status: SubscriptionStatusName;
  paymentStatus: PaymentStatusName;
  transactionRef: string | null;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isLive: boolean;
  subscriber: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    isActive: boolean;
    avatarUrl: string | null;
  };
  plan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    durationDays: number;
  };
};

export type AdminSubscriptionSummary = {
  activeNow: number;
  pendingPayment: number;
  expired: number;
  cancelled: number;
  total: number;
};

export type AdminSubscriptionListResponse = {
  items: AdminSubscription[];
  total: number;
  take: number;
  skip: number;
  summary: AdminSubscriptionSummary;
};

export type AdminSubscriptionUpdateInput = {
  status?: SubscriptionStatusName;
  paymentStatus?: PaymentStatusName;
  startsAt?: string;
  expiresAt?: string;
  extendDays?: number;
};

export const adminSubscriptionsApi = {
  list(params?: {
    q?: string;
    status?: string;
    paymentStatus?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.paymentStatus) qs.set("paymentStatus", params.paymentStatus);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminSubscriptionListResponse>(
      `/admin/subscriptions${suffix}`,
    );
  },

  get(id: string) {
    return apiFetch<AdminSubscription>(`/admin/subscriptions/${id}`);
  },

  update(id: string, input: AdminSubscriptionUpdateInput) {
    return apiFetch<AdminSubscription>(`/admin/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type AdminPaymentItem = {
  id: string;
  provider: string;
  providerRef: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatusName;
  purpose: "SUBSCRIPTION" | "PURCHASE" | string;
  metadata: Record<string, unknown> | null;
  label: string;
  createdAt: string;
  updatedAt: string;
  subscriber: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    phone?: string | null;
  };
  plan: {
    id: string;
    name: string;
    priceCents?: number;
    currency?: string;
    durationDays?: number;
  } | null;
  magazine: {
    id: string;
    title: string;
    issueNumber: string | null;
  } | null;
};

export type AdminPaymentSummary = {
  total: number;
  success: number;
  pending: number;
  failed: number;
  refunded: number;
  volumePaidCents: number;
};

export type AdminPaymentListResponse = {
  items: AdminPaymentItem[];
  total: number;
  take: number;
  skip: number;
  summary: AdminPaymentSummary;
};

export const adminPaymentsApi = {
  list(params?: {
    q?: string;
    status?: string;
    provider?: string;
    purpose?: string;
    from?: string;
    to?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.purpose) qs.set("purpose", params.purpose);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminPaymentListResponse>(`/admin/payments${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminPaymentItem>(`/admin/payments/${id}`);
  },

  updateStatus(
    id: string,
    input: { status: PaymentStatusName; note?: string; otp: string },
  ) {
    return apiFetch<AdminPaymentItem>(`/admin/payments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  requestStatusOtp(
    id: string,
    input: { status: PaymentStatusName; note?: string },
  ) {
    return apiFetch<{
      ok: boolean;
      expiresInSec: number;
      maskedEmail: string;
    }>(`/admin/payments/${id}/otp`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export type AdminSubscriberSubscription = {
  id: string;
  status: SubscriptionStatusName;
  paymentStatus: PaymentStatusName;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  isLive: boolean;
  plan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    durationDays: number;
  };
};

export type AdminSubscriber = {
  id: string;
  legacyId: number | null;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  address: string | null;
  subscriberCode: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasLiveSubscription: boolean;
  liveSubscription: Omit<AdminSubscriberSubscription, "createdAt"> | null;
  subscriptions: AdminSubscriberSubscription[];
};

export type AdminSubscriberSummary = {
  total: number;
  active: number;
  inactive: number;
  verified: number;
  withLiveSub: number;
};

export type AdminSubscriberListResponse = {
  items: AdminSubscriber[];
  total: number;
  take: number;
  skip: number;
  summary: AdminSubscriberSummary;
};

export type AdminSubscriberUpdateInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  country?: string | null;
  countryCode?: string | null;
  address?: string | null;
  isActive?: boolean;
};

export const adminSubscribersApi = {
  list(params?: {
    q?: string;
    active?: string;
    verified?: string;
    subscription?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.active) qs.set("active", params.active);
    if (params?.verified) qs.set("verified", params.verified);
    if (params?.subscription) qs.set("subscription", params.subscription);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminSubscriberListResponse>(
      `/admin/subscribers${suffix}`,
    );
  },

  get(id: string) {
    return apiFetch<AdminSubscriber>(`/admin/subscribers/${id}`);
  },

  update(id: string, input: AdminSubscriberUpdateInput) {
    return apiFetch<AdminSubscriber>(`/admin/subscribers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type NewsletterSubscribeResult = {
  ok: true;
  alreadySubscribed: boolean;
  message: string;
};

export const newsletterPublicApi = {
  subscribe(body: { email: string; acceptedTerms: boolean; source?: string }) {
    return apiFetch<NewsletterSubscribeResult>("/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export type AdminNewsletterItem = {
  id: string;
  email: string;
  isActive: boolean;
  source: string | null;
  acceptedTerms: boolean;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminNewsletterListResponse = {
  items: AdminNewsletterItem[];
  total: number;
  take: number;
  skip: number;
  summary: { total: number; active: number };
};

export const adminNewsletterApi = {
  list(params?: {
    q?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.active) qs.set("active", params.active);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminNewsletterListResponse>(
      `/admin/newsletter${suffix}`,
    );
  },

  setActive(id: string, isActive: boolean) {
    return apiFetch<{
      id: string;
      email: string;
      isActive: boolean;
      unsubscribedAt: string | null;
      updatedAt: string;
    }>(`/admin/newsletter/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  },
};

export type SocialNetwork =
  | "facebook"
  | "twitter"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "telegram"
  | "threads"
  | "other";

export type SiteSocialLink = {
  id: string;
  network: SocialNetwork;
  label: string;
  url: string;
};

export type SiteSocialSettings = {
  links: SiteSocialLink[];
  updatedAt: string;
};

export const settingsPublicApi = {
  social() {
    return apiFetch<SiteSocialSettings>("/settings/social");
  },
};

export const adminSettingsApi = {
  getSocial() {
    return apiFetch<SiteSocialSettings>("/admin/settings/social");
  },

  updateSocial(body: { links: SiteSocialLink[] }) {
    return apiFetch<SiteSocialSettings>("/admin/settings/social", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
};

export type AdminPlan = {
  id: string;
  legacyId: number | null;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  durationDays: number;
  isActive: boolean;
  subscriptionsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminPlanInput = {
  name: string;
  description?: string | null;
  priceCents: number;
  currency?: string;
  durationDays: number;
  isActive?: boolean;
};

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  durationDays: number;
};

export type PublicPayment = {
  id: string;
  provider: "STRIPE" | "FLEXPAIE" | "LEGACY";
  providerRef: string | null;
  amountCents: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED";
  purpose: "SUBSCRIPTION" | "PURCHASE";
  planId: string | null;
  plan: {
    id: string;
    name: string;
    durationDays: number;
    priceCents: number;
    currency: string;
  } | null;
  magazineId?: string | null;
  magazine?: {
    id: string;
    title: string;
    issueNumber: string | null;
    coverUrl?: string | null;
    theme?: { bgColor: string; accentColor: string } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export const plansApi = {
  list() {
    return apiFetch<{ items: PublicPlan[] }>("/plans");
  },
};

export const magazinesPublicApi = {
  list(takeOrOpts: number | { take?: number; skip?: number } = 12) {
    const take =
      typeof takeOrOpts === "number" ? takeOrOpts : (takeOrOpts.take ?? 12);
    const skip = typeof takeOrOpts === "number" ? 0 : (takeOrOpts.skip ?? 0);
    const qs = new URLSearchParams();
    qs.set("take", String(take));
    if (skip > 0) qs.set("skip", String(skip));
    return apiFetch<{
      items: PublicMagazineCard[];
      total: number;
      take: number;
      skip: number;
    }>(`/magazines?${qs}`);
  },

  latest() {
    return apiFetch<{
      id: string;
      title: string;
      issueNumber: string | null;
      coverUrl: string | null;
      publishedAt: string | null;
      theme: { bgColor: string; accentColor: string };
    } | null>("/magazines/latest");
  },

  get(id: string) {
    return apiFetch<PublicMagazineDetail>(
      `/magazines/${encodeURIComponent(id)}`,
    );
  },

  preview(id: string, opts?: { refresh?: boolean }) {
    const qs = opts?.refresh ? "?refresh=1" : "";
    return apiFetch<MagazineReadSession>(
      `/magazines/${encodeURIComponent(id)}/preview${qs}`,
    );
  },

  read(id: string, opts?: { refresh?: boolean }) {
    const qs = opts?.refresh ? "?refresh=1" : "";
    return apiFetch<MagazineReadSession>(
      `/magazines/${encodeURIComponent(id)}/read${qs}`,
    );
  },
};

export type PublicMagazineCard = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  priceCents: number | null;
  currency: string;
  accessType?: "FREE" | "PAID";
  dateLabel: string;
};

export type PublicMagazineDetail = PublicMagazineCard & {
  description: string | null;
  theme: { bgColor: string; accentColor: string };
  highlights: Array<{ label: string; text: string }>;
  relatedArticles?: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    coverUrl: string | null;
    category: string | null;
    publishedAt: string | null;
  }>;
};

export type PublicArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string | null;
  categoryLabel: string;
  categoryTone: string;
  authorName: string;
  publishedAt: string | null;
  dateLabel: string;
  viewCount: number;
};

export type PublicCategoryFeed = {
  category: string;
  label: string;
  tone: string;
  items: PublicArticleCard[];
  mostRead?: PublicArticleCard[];
  total: number;
  take: number;
  skip: number;
};

export type PublicHomeArticles = {
  featured: PublicArticleCard[];
  topGrid: PublicArticleCard[];
  decryptages: PublicArticleCard[];
  filInfo: PublicArticleCard[];
  startup: PublicArticleCard[];
  inspirationnel: PublicArticleCard[];
  zoom: PublicArticleCard[];
  gameChangers: PublicArticleCard[];
  plusVus: PublicArticleCard[];
  aNePasManquer: PublicArticleCard[];
};

export const articlesPublicApi = {
  home() {
    return apiFetch<PublicHomeArticles>("/articles/home");
  },

  recent(take = 3) {
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/recent?take=${encodeURIComponent(String(take))}`,
    );
  },

  random(take = 10) {
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/random?take=${encodeURIComponent(String(take))}`,
    );
  },

  related(slug: string, take = 6) {
    const qs = new URLSearchParams();
    qs.set("slug", slug);
    qs.set("take", String(take));
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/related?${qs}`,
    );
  },

  search(q: string, take = 10, category?: string, skip = 0) {
    const qs = new URLSearchParams();
    qs.set("q", q);
    qs.set("take", String(take));
    if (skip > 0) qs.set("skip", String(skip));
    if (category) qs.set("category", category);
    return apiFetch<{
      items: PublicArticleCard[];
      total: number;
      q: string;
      category: string | null;
      take: number;
      skip: number;
    }>(`/articles/search?${qs}`);
  },

  mostRead(take = 5) {
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/most-read?take=${encodeURIComponent(String(take))}`,
    );
  },

  feed(opts?: { take?: number; skip?: number }) {
    const qs = new URLSearchParams();
    qs.set("take", String(opts?.take ?? 12));
    if (opts?.skip != null) qs.set("skip", String(opts.skip));
    return apiFetch<PublicCategoryFeed>(`/articles/feed?${qs}`);
  },

  byCategory(
    slug: string,
    opts?: { take?: number; skip?: number },
  ) {
    const qs = new URLSearchParams();
    qs.set("take", String(opts?.take ?? 12));
    if (opts?.skip != null) qs.set("skip", String(opts.skip));
    return apiFetch<PublicCategoryFeed>(
      `/articles/category/${encodeURIComponent(slug)}?${qs}`,
    );
  },

  bySlug(slug: string) {
    return apiFetch<AdminArticle>(
      `/articles/${encodeURIComponent(slug)}`,
    );
  },
};

export type MagazineReadSession = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  accessType: string;
  canRead: boolean;
  preview?: boolean;
  maxPages?: number | null;
  theme?: { bgColor: string; accentColor: string };
  code: string | null;
  message: string | null;
  accessVia: "free" | "subscription" | "purchase" | "preview" | null;
  viewer: "pdf" | "pages" | null;
  readerUrl: string | null;
  downloadUrl: string | null;
  pagesStatus?: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  /** ISO — expiration des URLs signées des pages WebP. */
  pagesUrlExpiresAt?: string | null;
  pages?:
    | {
        pageNumber: number;
        url: string;
        thumbUrl: string | null;
        width: number;
        height: number;
      }[]
    | null;
};

export const paymentsApi = {
  createStripeCheckout(planId: string) {
    return apiFetch<{
      paymentId: string;
      clientSecret: string;
      publishableKey: string | null;
    }>("/payments/stripe/create", {
      method: "POST",
      body: JSON.stringify({ planId }),
    });
  },

  createStripePurchase(magazineId: string) {
    return apiFetch<{
      paymentId: string;
      clientSecret: string;
      publishableKey: string | null;
    }>("/payments/stripe/purchase", {
      method: "POST",
      body: JSON.stringify({ magazineId }),
    });
  },

  confirmStripe(
    paymentId: string,
    opts: { paymentIntentId?: string; sessionId?: string },
  ) {
    return apiFetch<PublicPayment>("/payments/stripe/confirm", {
      method: "POST",
      body: JSON.stringify({
        paymentId,
        paymentIntentId: opts.paymentIntentId,
        sessionId: opts.sessionId,
      }),
    });
  },

  createFlexpaie(planId: string, phone: string) {
    return apiFetch<{
      paymentId: string;
      reference: string;
      orderNumber: string | null;
      message: string;
    }>("/payments/flexpaie/create", {
      method: "POST",
      body: JSON.stringify({ planId, phone }),
    });
  },

  createFlexpaiePurchase(magazineId: string, phone: string) {
    return apiFetch<{
      paymentId: string;
      reference: string;
      orderNumber: string | null;
      message: string;
    }>("/payments/flexpaie/purchase", {
      method: "POST",
      body: JSON.stringify({ magazineId, phone }),
    });
  },

  get(id: string) {
    return apiFetch<PublicPayment>(`/payments/${id}`);
  },

  check(id: string) {
    return apiFetch<PublicPayment>(`/payments/${id}/check`, {
      method: "POST",
    });
  },
};

export const adminPlansApi = {
  list(params?: { active?: string }) {
    const qs = new URLSearchParams();
    if (params?.active) qs.set("active", params.active);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<{ items: AdminPlan[]; total: number }>(
      `/admin/plans${suffix}`,
    );
  },

  create(input: AdminPlanInput) {
    return apiFetch<AdminPlan>("/admin/plans", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminPlanInput>) {
    return apiFetch<AdminPlan>(`/admin/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type MagazineAccessType = "FREE" | "PAID";

export type AdminMagazine = {
  id: string;
  legacyId: number | null;
  title: string;
  description: string | null;
  issueNumber: string | null;
  accessType: MagazineAccessType;
  priceCents: number | null;
  currency: string;
  theme: { bgColor: string; accentColor: string };
  coverKey: string | null;
  coverUrl: string | null;
  pdfKey: string | null;
  previewKey: string | null;
  downloadKey: string | null;
  downloadUrl?: string | null;
  viewCount: number;
  isPublished: boolean;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminMagazineInput = {
  title: string;
  description?: string | null;
  issueNumber?: string | null;
  accessType: MagazineAccessType;
  priceCents?: number | null;
  currency?: string;
  theme?: { bgColor: string; accentColor: string } | null;
  coverKey?: string | null;
  pdfKey?: string | null;
  previewKey?: string | null;
  downloadKey?: string | null;
  isPublished?: boolean;
  isActive?: boolean;
};

export type AdminMagazineListResponse = {
  items: AdminMagazine[];
  total: number;
  take: number;
  skip: number;
};

export const adminMagazinesApi = {
  list(params?: {
    q?: string;
    published?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.published) qs.set("published", params.published);
    if (params?.active) qs.set("active", params.active);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminMagazineListResponse>(`/admin/magazines${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}`);
  },

  create(input: AdminMagazineInput) {
    return apiFetch<AdminMagazine>("/admin/magazines", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminMagazineInput>) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadCover(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminMagazine>(`/admin/magazines/${id}/cover`, body);
  },

  /** @deprecated Prefer uploadPdfDirect (presigned R2). */
  uploadPdf(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminMagazine>(`/admin/magazines/${id}/pdf`, body);
  },

  presignPdf(
    id: string,
    input: { filename: string; size: number; contentType?: string },
  ) {
    return apiFetch<{
      key: string;
      uploadUrl: string;
      headers: Record<string, string>;
      expiresIn: number;
      maxSize: number;
    }>(`/admin/magazines/${id}/pdf/presign`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  completePdf(id: string, input: { key: string; size: number }) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}/pdf/complete`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Upload PDF direct → R2 (presigned PUT), puis confirme côté API.
   * Pas de passage du fichier par Nest.
   */
  async uploadPdfDirect(
    id: string,
    file: File,
    opts?: {
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    },
  ) {
    if (file.size > 350_000_000) {
      throw new Error("Le PDF dépasse 350 Mo");
    }

    const signed = await this.presignPdf(id, {
      filename: file.name,
      size: file.size,
      contentType: file.type || "application/pdf",
    });

    await putFileToPresignedUrl(file, signed.uploadUrl, signed.headers, {
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });

    return this.completePdf(id, { key: signed.key, size: file.size });
  },
};

function putFileToPresignedUrl(
  file: File,
  uploadUrl: string,
  headers: Record<string, string>,
  opts?: {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);

    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !opts?.onProgress) return;
      const percent = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100),
      );
      opts.onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts?.onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new Error(
          `Échec upload R2 (${xhr.status}${xhr.statusText ? ` ${xhr.statusText}` : ""})`,
        ),
      );
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "Échec réseau vers R2 (CORS bucket ? lancez configure-r2-cors)",
        ),
      );
    };

    xhr.onabort = () => {
      reject(new Error("Upload PDF annulé"));
    };

    if (opts?.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

export const ARTICLE_CATEGORIES = [
  { value: "edito", label: "Édito" },
  { value: "grandes-entrevues", label: "Grandes entrevues" },
  { value: "decryptages", label: "Décryptages" },
  { value: "zoom", label: "Zoom" },
  { value: "entrevue-croisee", label: "Entrevue croisée" },
  { value: "start-up", label: "Start-up" },
  { value: "inspirationnel", label: "Inspirationnel" },
  { value: "game-changers", label: "Game changers" },
  { value: "vus-sur-le-net", label: "Vus sur le net" },
] as const;

export type ArticleCategoryValue =
  (typeof ARTICLE_CATEGORIES)[number]["value"];

export type AdminArticleBlock = {
  id: string | null;
  position: number;
  title: string | null;
  coverKey: string | null;
  coverCaption: string | null;
  coverUrl: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminArticleMagazine = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  isActive: boolean;
  theme?: { bgColor: string; accentColor: string };
};

export type AdminArticle = {
  id: string;
  legacyId: number | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverKey: string | null;
  coverCaption: string | null;
  coverUrl: string | null;
  category: string | null;
  viewCount: number;
  isPublished: boolean;
  isFeatured: boolean;
  magazineId: string | null;
  magazine: AdminArticleMagazine | null;
  authorId: string | null;
  author: { id: string; name: string; email: string } | null;
  commentsCount: number;
  blocks: AdminArticleBlock[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminArticleBlockInput = {
  id?: string;
  title?: string | null;
  coverCaption?: string | null;
  content?: string;
  position?: number;
};

export type AdminArticleInput = {
  title: string;
  slug?: string;
  content?: string;
  excerpt?: string | null;
  category?: string | null;
  coverCaption?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
  magazineId?: string | null;
  blocks?: AdminArticleBlockInput[];
};

export type AdminArticleSummary = {
  total: number;
  published: number;
  drafts: number;
  featured: number;
};

export type AdminArticleListResponse = {
  items: AdminArticle[];
  total: number;
  take: number;
  skip: number;
  summary: AdminArticleSummary;
};

export const adminArticlesApi = {
  list(params?: {
    q?: string;
    published?: string;
    category?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.published) qs.set("published", params.published);
    if (params?.category) qs.set("category", params.category);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminArticleListResponse>(`/admin/articles${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminArticle>(`/admin/articles/${id}`);
  },

  create(input: AdminArticleInput) {
    return apiFetch<AdminArticle>("/admin/articles", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminArticleInput>) {
    return apiFetch<AdminArticle>(`/admin/articles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove(id: string) {
    return apiFetch<{ ok: true }>(`/admin/articles/${id}`, {
      method: "DELETE",
    });
  },

  uploadCover(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminArticle>(`/admin/articles/${id}/cover`, body);
  },

  uploadBlockCover(articleId: string, blockId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminArticle>(
      `/admin/articles/${articleId}/blocks/${blockId}/cover`,
      body,
    );
  },
};
