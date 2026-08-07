"use client";

import { useEffect, useState } from "react";
import {
  settingsPublicApi,
  type SiteSocialLink,
} from "@/lib/api";
import { SocialNetworkIcon } from "@/lib/social-networks";

export function FooterSocial() {
  const [links, setLinks] = useState<SiteSocialLink[]>([]);

  useEffect(() => {
    let cancelled = false;
    settingsPublicApi
      .social()
      .then((res) => {
        if (!cancelled) setLinks(res.links ?? []);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = links.filter((l) => Boolean(l.url?.trim()));
  if (items.length === 0) return null;

  return (
    <ul className="opt-ft__social">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
          >
            <SocialNetworkIcon network={item.network} size={16} />
          </a>
        </li>
      ))}
    </ul>
  );
}
