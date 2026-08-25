"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  ChevronDown,
  LogOut,
  Menu,
  Receipt,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";
import { libraryApi } from "@/lib/api";
import { EmailVerifyBanner } from "./email-verify-banner";
import { HeaderLiveSearch } from "./header-live-search";
import { BrandLogo } from "./brand-logo";
import { ThemeToggle } from "./theme-toggle";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features";
import { RUBRIQUES } from "@/lib/rubriques";
import "./site-header.css";

const ICON = { size: 18, strokeWidth: 1.75 } as const;

const NAV_PRIMARY = RUBRIQUES.filter((r) => r.slug !== "stu-mag").map((r) => ({
  href: r.href,
  label: r.label,
}));

const FEATURED = {
  href: "/kiosque",
  label: "Nouveau numéro STU MAG",
};

/**
 * Header presse — identité STUDRC, logo centré, CTA abonnement.
 */
export function SiteHeader({ showNav = true }: { showNav?: boolean } = {}) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const accountRef = useRef<HTMLDivElement>(null);

  const loggedIn = !loading && Boolean(user);
  const authHref = loggedIn ? "/magazines" : "/connexion";
  const authLabel = loggedIn ? "Mon compte" : "Se connecter";

  useEffect(() => {
    if (!loggedIn) {
      setUnreadNotifications(0);
      return;
    }
    let cancelled = false;
    libraryApi
      .notificationsUnreadCount(3)
      .then((res) => {
        if (!cancelled) setUnreadNotifications(res.unreadCount);
      })
      .catch(() => {
        if (!cancelled) setUnreadNotifications(0);
      });
    function onUnread(e: Event) {
      const detail = (e as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setUnreadNotifications(detail.count);
      }
    }
    function onSeen() {
      setUnreadNotifications(0);
    }
    window.addEventListener("opt:notifications-unread", onUnread);
    window.addEventListener("opt:notifications-seen", onSeen);
    return () => {
      cancelled = true;
      window.removeEventListener("opt:notifications-unread", onUnread);
      window.removeEventListener("opt:notifications-seen", onSeen);
    };
  }, [loggedIn]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!showNav) return;

    let lastY = window.scrollY;
    let hidden = false;
    let accumulated = 0;
    let ignoreUntil = 0;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const now = performance.now();
        const y = Math.max(0, window.scrollY);

        // Après un toggle, ignorer le “saut” de scroll dû au shrink/expand du sticky.
        if (now < ignoreUntil) {
          lastY = y;
          accumulated = 0;
          ticking = false;
          return;
        }

        const delta = y - lastY;
        lastY = y;

        if (y < 24) {
          if (hidden) {
            hidden = false;
            accumulated = 0;
            ignoreUntil = now + 320;
            setNavHidden(false);
          }
          ticking = false;
          return;
        }

        // Accumuler dans le sens du geste (évite les micro-deltas trackpad).
        if (delta === 0) {
          ticking = false;
          return;
        }
        if (accumulated !== 0 && Math.sign(delta) !== Math.sign(accumulated)) {
          accumulated = 0;
        }
        accumulated += delta;

        if (accumulated > 28 && !hidden) {
          hidden = true;
          accumulated = 0;
          ignoreUntil = now + 320;
          setNavHidden(true);
        } else if (accumulated < -28 && hidden) {
          hidden = false;
          accumulated = 0;
          ignoreUntil = now + 320;
          setNavHidden(false);
        }

        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showNav]);

  useEffect(() => {
    if (!accountOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAccountOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  async function onLogout() {
    setAccountOpen(false);
    setMenuOpen(false);
    await logout();
    router.push("/");
  }

  return (
    <>
      <header className={`opt-header${showNav && navHidden ? " is-nav-hidden" : ""}`}>
        <div className="opt-header__top">
          <div className="opt-header__side opt-header__side--left">
            <button
              type="button"
              className="opt-header__menu-btn"
              aria-expanded={menuOpen}
              aria-controls="opt-menu-drawer"
              onClick={() => setMenuOpen(true)}
            >
              <Menu {...ICON} aria-hidden />
              <span>Menu</span>
            </button>

            <span className="opt-header__vsep" aria-hidden />

            <HeaderLiveSearch variant="header" />
          </div>

          <Link href="/" className="opt-header__brand" aria-label="STUDRC — Accueil">
            <BrandLogo height={52} />
          </Link>

          <div className="opt-header__side opt-header__side--right">
            <ThemeToggle />

            <span className="opt-header__vsep" aria-hidden />

            <Link href="/kiosque" className="opt-header__action">
              <BookOpen {...ICON} aria-hidden />
              <span>STU MAG</span>
            </Link>

            <span className="opt-header__vsep" aria-hidden />

            {loggedIn ? (
              <div className="opt-header__account" ref={accountRef}>
                <button
                  type="button"
                  className="opt-header__action opt-header__account-btn"
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                  onClick={() => setAccountOpen((v) => !v)}
                >
                  <span className="opt-header__avatar-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarSrc(user?.avatarUrl)}
                      alt=""
                      className="opt-header__avatar"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = avatarLocalFallback(
                          user?.avatarUrl,
                        );
                      }}
                    />
                    {unreadNotifications > 0 ? (
                      <span
                        className="opt-header__account-badge"
                        aria-label={`${unreadNotifications} notifications non lues`}
                      >
                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                      </span>
                    ) : null}
                  </span>
                  <span>{authLabel}</span>
                  <ChevronDown
                    size={16}
                    strokeWidth={2}
                    className={`opt-header__chevron${accountOpen ? " is-open" : ""}`}
                    aria-hidden
                  />
                </button>
                {accountOpen ? (
                  <div className="opt-header__dropdown" role="menu">
                    <Link
                      href="/magazines"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                    >
                      <BookOpen size={15} strokeWidth={2} aria-hidden />
                      Magazines
                    </Link>
                    <Link
                      href="/compte"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Settings size={15} strokeWidth={2} aria-hidden />
                      Paramètres
                    </Link>
                    <Link
                      href="/notifications"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Bell size={15} strokeWidth={2} aria-hidden />
                      Notifications
                      {unreadNotifications > 0 ? (
                        <span
                          className="opt-header__menu-badge"
                          aria-label={`${unreadNotifications} non lues`}
                        >
                          {unreadNotifications}
                        </span>
                      ) : null}
                    </Link>
                    <Link
                      href="/historique"
                      role="menuitem"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Receipt size={15} strokeWidth={2} aria-hidden />
                      Historique
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="opt-header__dropdown-logout"
                      onClick={() => void onLogout()}
                    >
                      <LogOut size={15} strokeWidth={2} aria-hidden />
                      Déconnexion
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link href={authHref} className="opt-header__action">
                <UserRound {...ICON} aria-hidden />
                <span>{authLabel}</span>
              </Link>
            )}

            {SUBSCRIPTIONS_ENABLED ? (
              <Link href="/abonnement" className="opt-header__cta">
                S&apos;abonner
              </Link>
            ) : null}
          </div>
        </div>

        {showNav ? (
          <nav
            className="opt-header__nav"
            aria-label="Rubriques"
            aria-hidden={navHidden}
          >
            <ul className="opt-header__nav-list">
              {NAV_PRIMARY.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
              <li className="opt-header__nav-sep" aria-hidden />
              <li>
                <Link href={FEATURED.href} className="opt-header__featured">
                  {FEATURED.label}
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}
        <EmailVerifyBanner />
      </header>

      <div
        className={`opt-menu${menuOpen ? " is-open" : ""}`}
        id="opt-menu-drawer"
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          className="opt-menu__backdrop"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
        />
        <aside className="opt-menu__panel" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="opt-menu__chrome">
            <div className="opt-menu__head">
              <span className="opt-menu__title">Menu</span>
              <button
                type="button"
                className="opt-menu__close"
                aria-label="Fermer"
                onClick={() => setMenuOpen(false)}
              >
                <X {...ICON} aria-hidden />
              </button>
            </div>

            <HeaderLiveSearch
              variant="menu"
              onNavigate={() => setMenuOpen(false)}
            />
          </div>

          <div className="opt-menu__body">
          <ul className="opt-menu__links">
            <li>
              <Link href="/" onClick={() => setMenuOpen(false)}>
                Accueil
              </Link>
            </li>
            {RUBRIQUES.map((item) => (
              <li key={item.slug}>
                <Link href={item.href} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="opt-menu__actions">
            <ThemeToggle variant="menu" />

            {loggedIn && user ? (
              <Link
                href="/compte"
                className="opt-menu__profile"
                onClick={() => setMenuOpen(false)}
              >
                <span className="opt-menu__profile-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc(user.avatarUrl)}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = avatarLocalFallback(user.avatarUrl);
                    }}
                  />
                </span>
                <span className="opt-menu__profile-meta">
                  <span className="opt-menu__profile-name">{user.name}</span>
                  <span className="opt-menu__profile-email">{user.email}</span>
                </span>
                <Settings size={16} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}

            {SUBSCRIPTIONS_ENABLED ? (
              <Link
                href="/abonnement"
                className="opt-menu__btn opt-menu__btn--cta"
                onClick={() => setMenuOpen(false)}
              >
                S&apos;abonner
              </Link>
            ) : null}

            {loggedIn ? (
              <div className="opt-menu__account-list" role="navigation" aria-label="Mon compte">
                <Link
                  href="/magazines"
                  className="opt-menu__row"
                  onClick={() => setMenuOpen(false)}
                >
                  <BookOpen size={18} strokeWidth={1.85} aria-hidden />
                  <span className="opt-menu__row-label">Magazines</span>
                </Link>
                <Link
                  href="/notifications"
                  className="opt-menu__row"
                  onClick={() => setMenuOpen(false)}
                >
                  <Bell size={18} strokeWidth={1.85} aria-hidden />
                  <span className="opt-menu__row-label">
                    Notifications
                    {unreadNotifications > 0 ? (
                      <span
                        className="opt-menu__badge"
                        aria-label={`${unreadNotifications} non lues`}
                      >
                        {unreadNotifications > 9 ? "9+" : unreadNotifications}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <Link
                  href="/compte"
                  className="opt-menu__row"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings size={18} strokeWidth={1.85} aria-hidden />
                  <span className="opt-menu__row-label">Paramètres</span>
                </Link>
                <Link
                  href="/historique"
                  className="opt-menu__row"
                  onClick={() => setMenuOpen(false)}
                >
                  <Receipt size={18} strokeWidth={1.85} aria-hidden />
                  <span className="opt-menu__row-label">Historique</span>
                </Link>
                <button
                  type="button"
                  className="opt-menu__row opt-menu__row--danger"
                  onClick={() => void onLogout()}
                >
                  <LogOut size={18} strokeWidth={1.85} aria-hidden />
                  <span className="opt-menu__row-label">Déconnexion</span>
                </button>
              </div>
            ) : (
              <Link
                href={authHref}
                className="opt-menu__btn opt-menu__btn--ghost"
                onClick={() => setMenuOpen(false)}
              >
                <UserRound size={18} strokeWidth={1.85} aria-hidden />
                {authLabel}
              </Link>
            )}
          </div>
          </div>
        </aside>
      </div>
    </>
  );
}
