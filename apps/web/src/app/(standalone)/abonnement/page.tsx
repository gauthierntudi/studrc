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
  title: string;
  coverUrl: string;
  issueNumber: string | null;
} | null> {
  try {
    const res = await fetch(`${API_URL}/api/magazines/latest`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const latest = (await res.json()) as {
      title?: string;
      coverUrl?: string | null;
      issueNumber?: string | null;
    } | null;
    if (latest?.coverUrl && latest.title) {
      return {
        title: latest.title,
        coverUrl: latest.coverUrl,
        issueNumber: latest.issueNumber ?? null,
      };
    }
  } catch {
    /* fallback demo */
  }
  const demo = DEMO_MAGAZINES[0];
  return {
    title: demo.titre,
    coverUrl: demo.cover,
    issueNumber: null,
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
