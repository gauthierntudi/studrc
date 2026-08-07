"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { adminAuthApi, type AdminUser } from "@/lib/api";
import {
  clearAdminEmailHint,
  getAdminEmailHint,
  setAdminEmailHint,
} from "@/lib/admin-session-hint";

type AdminAuthContextValue = {
  admin: AdminUser | null;
  loading: boolean;
  expired: boolean;
  refreshAdmin: () => Promise<void>;
  retrySession: () => Promise<void>;
  setAdmin: (admin: AdminUser | null) => void;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdminState] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const isLoginPage = pathname === "/admin/connexion";

  const setAdmin = useCallback((next: AdminUser | null) => {
    setAdminState(next);
    if (next?.email) {
      setAdminEmailHint(next.email);
    }
  }, []);

  const refreshAdmin = useCallback(async () => {
    try {
      const me = await adminAuthApi.me();
      setAdmin(me);
      setExpired(false);
    } catch {
      try {
        const refreshed = await adminAuthApi.refresh();
        setAdmin(refreshed);
        setExpired(false);
      } catch {
        setAdminState(null);
        // Écran « session expirée » seulement si un admin s’était déjà connecté
        // (email mémorisé). Sinon → redirection login (visite anonyme).
        if (getAdminEmailHint()) {
          setExpired(true);
        } else {
          setExpired(false);
          if (!isLoginPage) {
            router.replace("/admin/connexion");
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isLoginPage, router, setAdmin]);

  const retrySession = useCallback(async () => {
    setLoading(true);
    setExpired(false);
    await refreshAdmin();
  }, [refreshAdmin]);

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    void refreshAdmin();
  }, [isLoginPage, refreshAdmin]);

  /** Renouvelle le access token avant expiration (15 min) tant que l’onglet est ouvert. */
  useEffect(() => {
    if (isLoginPage || !admin) return;

    const REFRESH_EVERY_MS = 12 * 60 * 1000;
    const id = window.setInterval(() => {
      void adminAuthApi.refresh().then(
        (me) => {
          setAdmin(me);
          setExpired(false);
        },
        () => {
          /* le prochain appel API retentera via apiFetch */
        },
      );
    }, REFRESH_EVERY_MS);

    return () => window.clearInterval(id);
  }, [admin, isLoginPage, setAdmin]);

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout();
    } catch {
      // ignore
    }
    setAdminState(null);
    setExpired(false);
    clearAdminEmailHint();
    router.replace("/admin/connexion");
  }, [router]);

  const value = useMemo(
    () => ({
      admin,
      loading,
      expired,
      refreshAdmin,
      retrySession,
      setAdmin,
      logout,
    }),
    [admin, loading, expired, refreshAdmin, retrySession, setAdmin, logout],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
