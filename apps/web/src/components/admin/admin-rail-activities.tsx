"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_ACTIVITY_REFRESH } from "@/lib/admin-activity-bus";
import {
  adminActivityApi,
  type AdminActivityItem,
} from "@/lib/api";
import { avatarLocalFallback, avatarSrc } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const DEFAULT_AVATAR = "/legacy/img/user.jpg";

function actorTone(item: AdminActivityItem): "mint" | "blue" | "violet" {
  if (item.actorType === "ADMIN") return "mint";
  if (item.actorType === "SUBSCRIBER") return "blue";
  return "violet";
}

function actorAvatarUrl(item: AdminActivityItem): string {
  if (item.actorType === "ADMIN") {
    return avatarSrc(item.admin?.avatarUrl);
  }
  if (item.actorType === "SUBSCRIBER") {
    return avatarSrc(item.subscriber?.avatarUrl);
  }
  return DEFAULT_AVATAR;
}

function actorLabel(item: AdminActivityItem): string {
  return (
    item.admin?.name ||
    item.subscriber?.name ||
    item.admin?.email ||
    item.subscriber?.email ||
    (item.actorType === "SYSTEM" ? "Système" : item.actorType)
  );
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function RailActorBadge({ item }: { item: AdminActivityItem }) {
  const src = actorAvatarUrl(item);
  return (
    <span
      className={cn(
        "snow-dash__rail-badge",
        "snow-dash__rail-badge--photo",
        `snow-dash__rail-badge--${actorTone(item)}`,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = avatarLocalFallback(
            item.admin?.avatarUrl ?? item.subscriber?.avatarUrl,
          );
        }}
      />
    </span>
  );
}

export function AdminRailActivities() {
  const [items, setItems] = useState<AdminActivityItem[] | null>(null);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminActivityApi.recent(8);
      setItems(res.items);
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();

    const onRefresh = () => {
      // Le log côté API est souvent fire-and-forget : 1er fetch immédiat + 1 après commit.
      void load();
      if (delayRef.current) clearTimeout(delayRef.current);
      delayRef.current = setTimeout(() => {
        void load();
        delayRef.current = null;
      }, 450);
    };

    window.addEventListener(ADMIN_ACTIVITY_REFRESH, onRefresh);
    return () => {
      window.removeEventListener(ADMIN_ACTIVITY_REFRESH, onRefresh);
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, [load]);

  if (items === null) {
    return (
      <section className="snow-dash__rail-block">
        <div className="snow-dash__rail-heading">
          <h2 className="snow-dash__rail-title">Activités</h2>
        </div>
        <p className="snow-dash__rail-empty">Chargement…</p>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="snow-dash__rail-block">
        <div className="snow-dash__rail-heading">
          <h2 className="snow-dash__rail-title">Activités</h2>
          <Link href="/admin/activites" className="snow-dash__rail-link">
            Voir tout
          </Link>
        </div>
        <p className="snow-dash__rail-empty">Aucune activité pour le moment.</p>
      </section>
    );
  }

  return (
    <section className="snow-dash__rail-block">
      <div className="snow-dash__rail-heading">
        <h2 className="snow-dash__rail-title">Activités</h2>
        <Link href="/admin/activites" className="snow-dash__rail-link">
          Voir tout
        </Link>
      </div>
      <ul className="snow-dash__rail-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href="/admin/activites" className="snow-dash__rail-item">
              <RailActorBadge item={item} />
              <div>
                <p className="snow-dash__rail-item-title">
                  {item.actionLabel}
                </p>
                <p className="snow-dash__rail-item-time">
                  {actorLabel(item)} · {formatWhen(item.createdAt)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
