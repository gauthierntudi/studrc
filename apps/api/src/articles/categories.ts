export type CategoryTone = 'red' | 'blue' | 'gold' | 'teal' | 'dark';

export type CategoryMeta = {
  label: string;
  tone: CategoryTone;
  /** Anciennes rubriques Opt1mum encore présentes en base. */
  aliases?: string[];
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  'stu-news': {
    label: 'STU NEWS',
    tone: 'red',
    aliases: ['edito', 'start-up', 'vus-sur-le-net', 'zoom'],
  },
  'stu-data': {
    label: 'STU DATA',
    tone: 'blue',
    aliases: ['decryptages', 'decryptage'],
  },
  'stu-stories': {
    label: 'STU STORIES',
    tone: 'gold',
    aliases: ['inspirationnel', 'game-changers', 'game-changer'],
  },
  'stu-talk': {
    label: 'STU TALK',
    tone: 'teal',
    aliases: ['grandes-entrevues', 'grande-entrevue', 'entrevue-croisee'],
  },
  'stu-mag': {
    label: 'STU MAG',
    tone: 'dark',
  },
};

const ALIAS_TO_CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [slug, meta] of Object.entries(CATEGORY_META)) {
    map[slug] = slug;
    for (const alias of meta.aliases ?? []) {
      map[alias] = slug;
    }
  }
  return map;
})();

export function resolveCategorySlug(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return ALIAS_TO_CANONICAL[key] ?? (CATEGORY_META[key] ? key : null);
}

export function categoryQuerySlugs(canonical: string): string[] {
  const meta = CATEGORY_META[canonical];
  if (!meta) return [canonical];
  return [canonical, ...(meta.aliases ?? [])];
}

export function categoryDisplay(raw: string | null | undefined): {
  label: string;
  tone: CategoryTone;
} {
  const key = raw?.trim() || '';
  const canonical = resolveCategorySlug(key) ?? key;
  const meta = CATEGORY_META[canonical];
  if (meta) return { label: meta.label, tone: meta.tone };
  return { label: key || 'Actualité', tone: 'teal' };
}

export const VIDEO_CATEGORY_SLUGS = ['stu-talk', 'stu-stories'] as const;

export function isVideoCategory(raw: string | null | undefined): boolean {
  const slug = resolveCategorySlug(raw ?? '');
  return slug === 'stu-talk' || slug === 'stu-stories';
}
