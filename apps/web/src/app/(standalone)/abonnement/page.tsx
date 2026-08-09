import type { PublicPlan } from "@/lib/api";
import { DEMO_MAGAZINES } from "@/lib/legacy-demo";
import AbonnementClient from "./abonnement-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function loadPlans(): Promise<PublicPlan[]> {
  try {
    const res = await fetch(`${API_URL}/api/plans`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PublicPlan[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function loadCover(): Promise<{
  id: string;
  title: string;
  coverUrl: string;
  issueNumber: string | null;
  theme: { bgColor: string; accentColor: string };
} | null> {
  try {
    const res = await fetch(`${API_URL}/api/magazines/latest`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const latest = (await res.json()) as {
      id?: string;
      title?: string;
      coverUrl?: string | null;
      issueNumber?: string | null;
      theme?: { bgColor: string; accentColor: string } | null;
    } | null;
    if (latest?.coverUrl && latest.title && latest.id) {
      return {
        id: latest.id,
        title: latest.title,
        coverUrl: latest.coverUrl,
        issueNumber: latest.issueNumber ?? null,
        theme: latest.theme ?? { bgColor: "#0d203d", accentColor: "#02d0d1" },
      };
    }
  } catch {
    /* fallback demo */
  }
  const demo = DEMO_MAGAZINES[0];
  return {
    id: String(demo.id),
    title: demo.titre,
    coverUrl: demo.cover,
    issueNumber: null,
    theme: { bgColor: demo.bgColor, accentColor: demo.themeColor },
  };
}

export default async function AbonnementPage() {
  const [initialPlans, initialCover] = await Promise.all([
    loadPlans(),
    loadCover(),
  ]);

  return (
    <AbonnementClient
      initialPlans={initialPlans}
      initialCover={initialCover}
    />
  );
}
