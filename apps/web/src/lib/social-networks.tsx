import type { ReactNode } from "react";
import type { SocialNetwork } from "@/lib/api";

export const SOCIAL_NETWORK_META: Record<
  SocialNetwork,
  { label: string; tone: string; placeholder: string }
> = {
  facebook: {
    label: "Facebook",
    tone: "#1877f2",
    placeholder: "https://facebook.com/Opt1mumMag",
  },
  twitter: {
    label: "X / Twitter",
    tone: "#111111",
    placeholder: "https://x.com/OptimumCorp",
  },
  instagram: {
    label: "Instagram",
    tone: "#e1306c",
    placeholder: "https://instagram.com/opt1mum",
  },
  linkedin: {
    label: "LinkedIn",
    tone: "#0a66c2",
    placeholder: "https://linkedin.com/company/opt1mum",
  },
  youtube: {
    label: "YouTube",
    tone: "#ff0000",
    placeholder: "https://youtube.com/@opt1mum",
  },
  tiktok: {
    label: "TikTok",
    tone: "#111111",
    placeholder: "https://tiktok.com/@opt1mum",
  },
  whatsapp: {
    label: "WhatsApp",
    tone: "#25d366",
    placeholder: "https://wa.me/243828504000",
  },
  telegram: {
    label: "Telegram",
    tone: "#229ed9",
    placeholder: "https://t.me/opt1mum",
  },
  threads: {
    label: "Threads",
    tone: "#111111",
    placeholder: "https://threads.net/@opt1mum",
  },
  other: {
    label: "Autre",
    tone: "#02d0d1",
    placeholder: "https://…",
  },
};

export function SocialNetworkIcon({
  network,
  size = 16,
}: {
  network: SocialNetwork;
  size?: number;
}): ReactNode {
  switch (network) {
    case "facebook":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14C17.174 2.097 15.943 2 14.643 2 11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4z" />
        </svg>
      );
    case "twitter":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2H21.5l-7.5 8.57L22.5 22h-6.563l-5.14-6.72L4.5 22H1.244l8.03-9.17L1.5 2h6.72l4.64 6.13L18.244 2zm-1.15 18h1.812L7.02 3.89H5.078L17.094 20z" />
        </svg>
      );
    case "instagram":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 7a5 5 0 100 10 5 5 0 000-10zm0 8.2A3.2 3.2 0 1112 8.8a3.2 3.2 0 010 6.4z" />
          <path d="M16.8 2H7.2A5.2 5.2 0 002 7.2v9.6A5.2 5.2 0 007.2 22h9.6a5.2 5.2 0 005.2-5.2V7.2A5.2 5.2 0 0016.8 2zm3.4 14.8a3.4 3.4 0 01-3.4 3.4H7.2a3.4 3.4 0 01-3.4-3.4V7.2A3.4 3.4 0 017.2 3.8h9.6a3.4 3.4 0 013.4 3.4v9.6z" />
          <circle cx="17.5" cy="6.5" r="1.2" />
        </svg>
      );
    case "linkedin":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M6.94 8.5H3.56V21h3.38V8.5zM5.25 3a2 2 0 100 4 2 2 0 000-4zM20.44 21h-3.37v-6.25c0-1.49-.53-2.5-1.86-2.5-1.01 0-1.61.68-1.88 1.34-.1.24-.12.57-.12.9V21H10v-12.5h3.24v1.71c.43-.66 1.2-1.61 2.93-1.61 2.14 0 3.75 1.4 3.75 4.4V21z" />
        </svg>
      );
    case "youtube":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2 31.5 31.5 0 000 12a31.5 31.5 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31.5 31.5 0 0024 12a31.5 31.5 0 00-.5-5.8zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M19.6 7.4a5.8 5.8 0 01-3.4-1.1v7.3a5.7 5.7 0 11-5.7-5.7c.3 0 .6 0 .9.1v2.8a2.9 2.9 0 100 5.7 2.9 2.9 0 002.9-2.9V2h2.8a5.8 5.8 0 003.4 3.3v2.1z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.5 3.5A10.5 10.5 0 003.4 17.7L2 22l4.4-1.4A10.5 10.5 0 1020.5 3.5zm-8.5 16a8.6 8.6 0 01-4.4-1.2l-.3-.2-2.6.8.8-2.5-.2-.3a8.6 8.6 0 1111.7 3.4 8.5 8.5 0 01-5 1zm4.7-6.4c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6.1a7 7 0 01-2-1.2 7.7 7.7 0 01-1.4-1.8c-.2-.3 0-.4.1-.6l.4-.5.1-.3a.5.5 0 000-.5c0-.1-.6-1.4-.8-1.9s-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 2.9 2.9 0 00-.9 2.2 5 5 0 001.1 2.6 11.4 11.4 0 004.4 3.9c.5.2 1 .4 1.4.5a3.3 3.3 0 001.7.1 2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.2-1.2c-.1-.1-.3-.2-.6-.3z" />
        </svg>
      );
    case "telegram":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M21.9 4.3L2.7 11.7c-1.3.5-1.3 1.2-.2 1.5l4.9 1.5 1.9 5.8c.2.7.4.9 1 .9.6 0 .8-.3 1.1-.6l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.2-.5-1.8-1.5-1.4zM9.2 14.7l8.6-5.4c.4-.3.8-.1.5.2l-7 6.3-.3 3.1-1.8-4.2z" />
        </svg>
      );
    case "threads":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M16.3 11.3c-.1-2.2-1.3-3.7-3.6-3.9h-.1c-2.4.1-3.9 1.7-3.9 4.2 0 2.2 1.2 3.7 3.3 4 .7.1 1.4 0 2-.2-.3.6-.8 1-1.6 1.2-.9.2-1.8.1-2.6-.3l-.5 1.7c1.1.5 2.3.7 3.5.6 3.1-.3 5.1-2.4 5.2-5.7v-.2c.7-.5 1.3-1.2 1.6-2.1l-1.8-.6c-.2.5-.6 1-1.1 1.3zm-3.6 2.4c-1.1-.1-1.8-.8-1.8-2.1 0-1.4.7-2.2 1.8-2.3h.1c1.1.1 1.7.8 1.8 2.2 0 .1 0 .1 0 .2-.5.1-1.1.2-1.9 0z" />
          <path d="M12.1 2C6.6 2 2.2 6.3 2 11.7v.6C2.2 17.7 6.6 22 12.1 22c5.5 0 9.9-4.3 10.1-9.7v-.6C22 6.3 17.6 2 12.1 2zm8.1 10.3c-.2 4.4-3.8 7.9-8.1 7.9s-7.9-3.5-8.1-7.9v-.6C4.2 6.3 7.8 2.8 12.1 2.8s7.9 3.5 8.1 7.9v.6z" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M10 13a5 5 0 007.07 0l2.12-2.12a5 5 0 00-7.07-7.07L11 5" />
          <path d="M14 11a5 5 0 00-7.07 0L4.81 13.12a5 5 0 007.07 7.07L13 19" />
        </svg>
      );
  }
}
