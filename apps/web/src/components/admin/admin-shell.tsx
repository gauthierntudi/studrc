"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Moon,
  Newspaper,
  Package,
  PanelLeft,
  PanelRight,
  ScrollText,
  Share2,
  ShieldCheck,
  Sun,
  UserCog,
  UserRound,
  Users,
  X,
  Activity,
} from "lucide-react";
import { AdminBrandLogo } from "@/components/admin/admin-brand-logo";
import { AdminModal } from "@/components/admin/admin-modal";
import { AdminRailActivities } from "@/components/admin/admin-rail-activities";
import type { AdminUser } from "@/lib/api";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type DashTheme = "dark" | "light";
const THEME_KEY = "opt1mum-admin-dash-theme";
const RAIL_KEY = "opt1mum-admin-rail";
const RAIL_DESKTOP_MQ = "(min-width: 1200px)";

const PAGE_LABEL: Record<string, string> = {
  "/admin": "Tableau de bord",
  "/admin/magazines": "Magazines",
  "/admin/abonnements": "Abonnements",
  "/admin/paiements": "Historique paiements",
  "/admin/abonnes": "Abonnés",
  "/admin/newsletter": "Newsletter",
  "/admin/reseaux": "Réseaux sociaux",
  "/admin/actualites": "Actualités",
  "/admin/publicite": "Publicité",
  "/admin/monitoring": "Monitoring",
  "/admin/staff": "Staff",
  "/admin/activites": "Logs activités",
  "/admin/profil": "Profil",
};

/**
 * Shell admin calqué sur trompette-next (snow-dash) —
 * auth cookies Nest via AdminAuthGate, pas de JWT localStorage.
 */
export function AdminShell({
  children,
  admin,
  onLogout,
}: {
  children: React.ReactNode;
  admin: AdminUser;
  onLogout: () => void | Promise<void>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [theme, setTheme] = useState<DashTheme>("dark");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* ignore */
    }

    try {
      const storedRail = window.localStorage.getItem(RAIL_KEY);
      if (storedRail === "1" || storedRail === "0") {
        setRailOpen(storedRail === "1");
      } else {
        setRailOpen(window.matchMedia(RAIL_DESKTOP_MQ).matches);
      }
    } catch {
      setRailOpen(window.matchMedia(RAIL_DESKTOP_MQ).matches);
    }
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next: DashTheme = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleRail() {
    setRailOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(RAIL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function confirmLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  const canManageStaff =
    admin.role === "SUPERADMIN" || admin.role === "ADMIN";
  const isSuperAdmin = admin.role === "SUPERADMIN";

  const nav = [
    { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/admin/magazines", label: "Magazines", icon: Package },
    { href: "/admin/abonnements", label: "Abonnements", icon: CreditCard },
    { href: "/admin/paiements", label: "Historique paiements", icon: History },
    { href: "/admin/abonnes", label: "Abonnés", icon: Users },
    { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
    { href: "/admin/reseaux", label: "Réseaux sociaux", icon: Share2 },
    { href: "/admin/actualites", label: "Actualités", icon: Newspaper },
    ...(isSuperAdmin
      ? [{ href: "/admin/monitoring", label: "Monitoring", icon: Activity }]
      : []),
    ...(canManageStaff
      ? [{ href: "/admin/staff", label: "Staff", icon: UserCog }]
      : []),
    { href: "/admin/activites", label: "Logs activités", icon: ScrollText },
    { href: "/admin/profil", label: "Mon profil", icon: UserRound },
  ];

  const crumb =
    Object.entries(PAGE_LABEL).find(([href]) =>
      href === "/admin" ? pathname === "/admin" : pathname.startsWith(href),
    )?.[1] ?? "Admin";

  const sidebar = (
    <>
      <div className="snow-dash__brand">
        <AdminBrandLogo
          variant={theme === "dark" ? "white" : "default"}
          width={148}
          height={52}
          href="/admin"
        />
      </div>

      <div className="snow-dash__nav-scroll">
        <div className="snow-dash__nav-group">
          <p className="snow-dash__nav-heading">Ops</p>
          {nav.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "snow-dash__nav-item",
                  active && "snow-dash__nav-item--active",
                )}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <Icon
                  className="snow-dash__nav-icon"
                  strokeWidth={1.6}
                  aria-hidden
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="snow-dash__nav-group">
          <p className="snow-dash__nav-heading">Rôle</p>
          <div className="admin-dash__role" title={admin.role}>
            <ShieldCheck className="h-4 w-4" strokeWidth={1.6} aria-hidden />
            <span>{admin.role}</span>
          </div>
        </div>
      </div>

      <div className="snow-dash__footer">
        <Link
          href="/admin/profil"
          className="snow-dash__user"
          title={admin.email}
          onClick={() => setMobileOpen(false)}
        >
          <span className="snow-dash__user-avatar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc(admin.avatarUrl)}
              alt=""
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = avatarLocalFallback(admin.avatarUrl);
              }}
            />
          </span>
          <span className="snow-dash__user-meta">
            <span className="snow-dash__user-name">{admin.name || "Admin"}</span>
            <span className="snow-dash__user-loc">{admin.email}</span>
          </span>
        </Link>
        <button
          type="button"
          className="snow-dash__logout snow-dash__logout--danger"
          onClick={() => {
            setMobileOpen(false);
            setLogoutOpen(true);
          }}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.6} aria-hidden />
          Déconnexion
        </button>
      </div>
    </>
  );

  return (
    <div
      className={cn(
        "snow-dash snow-dash--admin",
        railOpen && "snow-dash--rail-open",
      )}
      data-theme={theme}
    >
      <aside className="snow-dash__sidebar snow-dash__sidebar--desktop">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="snow-dash__drawer">
          <button
            type="button"
            className="snow-dash__drawer-backdrop"
            aria-label="Fermer"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="snow-dash__sidebar snow-dash__sidebar--mobile">
            <button
              type="button"
              className="snow-dash__drawer-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="snow-dash__center">
        <header className="snow-dash__topbar">
          <div className="snow-dash__topbar-left">
            <button
              type="button"
              className="snow-dash__burger"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" strokeWidth={1.6} />
            </button>
            <div className="snow-dash__crumbs">
              <PanelLeft
                className="h-4 w-4 opacity-50 snow-dash__crumbs-icon"
                strokeWidth={1.6}
                aria-hidden
              />
              <span className="snow-dash__crumbs-root">Admin</span>
              <span className="snow-dash__crumbs-sep">/</span>
              <strong>{crumb}</strong>
            </div>
          </div>

          <div className="snow-dash__topbar-right">
            <button
              type="button"
              className="snow-dash__icon-btn"
              aria-label={
                theme === "dark"
                  ? "Passer en mode clair"
                  : "Passer en mode sombre"
              }
              aria-pressed={theme === "light"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" strokeWidth={1.6} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.6} />
              )}
            </button>
            <button
              type="button"
              className={cn(
                "snow-dash__icon-btn",
                railOpen && "snow-dash__icon-btn--active",
              )}
              aria-label={
                railOpen
                  ? "Fermer le panneau latéral"
                  : "Ouvrir le panneau latéral"
              }
              aria-pressed={railOpen}
              onClick={toggleRail}
            >
              <PanelRight className="h-4 w-4" strokeWidth={1.6} />
            </button>
            <Link
              href="/admin/profil"
              className="snow-dash__header-avatar"
              aria-label="Mon profil"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarSrc(admin.avatarUrl)}
                alt=""
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = avatarLocalFallback(admin.avatarUrl);
                }}
              />
            </Link>
          </div>
        </header>

        <div className="snow-dash__content">{children}</div>
      </div>

      <aside
        className={cn("snow-dash__rail", railOpen && "snow-dash__rail--open")}
      >
        <button
          type="button"
          className="snow-dash__rail-close"
          onClick={toggleRail}
          aria-label="Fermer le panneau"
        >
          <X className="h-4 w-4" />
        </button>
        <AdminRailActivities />
      </aside>

      <AdminModal
        open={logoutOpen}
        title="Déconnexion"
        onClose={() => {
          if (!loggingOut) setLogoutOpen(false);
        }}
      >
        <div className="admin-logout-confirm">
          <p>
            Voulez-vous vraiment vous déconnecter de la console admin&nbsp;?
          </p>
          <div className="admin-logout-confirm__actions">
            <button
              type="button"
              className="admin-dash__btn"
              disabled={loggingOut}
              onClick={() => setLogoutOpen(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="admin-dash__btn admin-dash__btn--danger"
              disabled={loggingOut}
              onClick={() => void confirmLogout()}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              {loggingOut ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
