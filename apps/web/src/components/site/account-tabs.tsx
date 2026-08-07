"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { libraryApi } from "@/lib/api";
import "./account-tabs.css";

const TABS = [
  { href: "/magazines", label: "Magazine" },
  { href: "/compte", label: "Paramètres" },
  { href: "/mon-abonnement", label: "Abonnement" },
  { href: "/mes-achats", label: "Mes achats", badge: "purchases" as const },
  {
    href: "/notifications",
    label: "Notifications",
    badge: "notifications" as const,
  },
  { href: "/historique", label: "Historique" },
] as const;

export function AccountTabs() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!user) {
      setPurchasesCount(0);
      setUnreadNotifications(0);
      return;
    }
    let cancelled = false;

    function loadBadges() {
      libraryApi
        .purchases()
        .then((res) => {
          if (!cancelled) setPurchasesCount(res.purchases.length);
        })
        .catch(() => {
          if (!cancelled) setPurchasesCount(0);
        });

      libraryApi
        .notificationsUnreadCount(3)
        .then((res) => {
          if (!cancelled) setUnreadNotifications(res.unreadCount);
        })
        .catch(() => {
          if (!cancelled) setUnreadNotifications(0);
        });
    }

    loadBadges();

    function onSeen() {
      setUnreadNotifications(0);
    }
    function onUnread(e: Event) {
      const detail = (e as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setUnreadNotifications(detail.count);
      }
    }
    window.addEventListener("opt:notifications-seen", onSeen);
    window.addEventListener("opt:notifications-unread", onUnread);
    return () => {
      cancelled = true;
      window.removeEventListener("opt:notifications-seen", onSeen);
      window.removeEventListener("opt:notifications-unread", onUnread);
    };
  }, [user]);

  return (
    <nav className="opt-account-tabs" aria-label="Espace abonné">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const showPurchasesBadge =
          "badge" in tab &&
          tab.badge === "purchases" &&
          purchasesCount > 0;
        const showNotifBadge =
          "badge" in tab &&
          tab.badge === "notifications" &&
          unreadNotifications > 0;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`opt-account-tabs__tab${active ? " is-active" : ""}`}
          >
            {tab.label}
            {showPurchasesBadge ? (
              <span
                className="opt-account-tabs__badge opt-account-tabs__badge--muted"
                aria-label={`${purchasesCount} achats`}
              >
                {purchasesCount}
              </span>
            ) : null}
            {showNotifBadge ? (
              <span
                className="opt-account-tabs__badge"
                aria-label={`${unreadNotifications} non lues`}
              >
                {unreadNotifications}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
