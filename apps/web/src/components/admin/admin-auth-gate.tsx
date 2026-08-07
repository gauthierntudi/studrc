"use client";

import { useAdminAuth } from "@/components/admin/admin-auth-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { SessionExpiredScreen } from "@/components/admin/session-expired-screen";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const { admin, loading, expired, logout, retrySession } = useAdminAuth();

  if (loading) {
    return (
      <div
        className="admin-dash__boot"
        data-theme="dark"
        role="status"
        aria-live="polite"
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.2)",
            borderTopColor: "#02d0d1",
            animation: "admin-spin 0.8s linear infinite",
          }}
        />
        <p className="admin-dash__boot-msg">Chargement…</p>
        <style>{`@keyframes admin-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Session expirée uniquement si un email admin est (déjà) en localStorage
  if (expired) {
    return (
      <SessionExpiredScreen
        variant="admin"
        title="Session admin expirée"
        description="Votre session opérateur n’est plus valide. Reconnectez-vous pour accéder au tableau de bord et reprendre vos opérations."
        loginLabel="Se reconnecter"
        homeHref="/"
        homeLabel="Retour au site"
        onRetry={retrySession}
      />
    );
  }

  if (!admin) {
    return (
      <div
        className="admin-dash__boot"
        data-theme="dark"
        role="status"
        aria-live="polite"
      >
        <p className="admin-dash__boot-msg">Redirection…</p>
      </div>
    );
  }

  return (
    <AdminShell admin={admin} onLogout={logout}>
      {children}
    </AdminShell>
  );
}
