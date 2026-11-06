import { cn } from "@/lib/utils";
import "./article-thumb-sponsor.css";

export type ThumbSponsor = {
  name: string;
  logoUrl: string | null;
} | null | undefined;

export function ArticleThumbSponsor({
  sponsor,
  className,
  compact,
  inline,
}: {
  sponsor?: ThumbSponsor;
  className?: string;
  compact?: boolean;
  inline?: boolean;
}) {
  if (!sponsor?.logoUrl && !sponsor?.name) return null;
  return (
    <span
      className={cn(
        "opt-thumb-sponsor",
        compact && "opt-thumb-sponsor--sm",
        inline && "opt-thumb-sponsor--inline",
        className,
      )}
      title={`Sponsorisé Par ${sponsor.name}`}
    >
      <em>Sponsorisé Par</em>
      {sponsor.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sponsor.logoUrl} alt="" />
      ) : null}
    </span>
  );
}
