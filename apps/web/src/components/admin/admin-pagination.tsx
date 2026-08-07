"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminPaginationProps = {
  total: number;
  take: number;
  skip: number;
  onSkipChange: (skip: number) => void;
  className?: string;
};

function buildPageItems(current: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const pages = new Set<number>();
  pages.add(1);
  pages.add(pageCount);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function AdminPagination({
  total,
  take,
  skip,
  onSkipChange,
  className,
}: AdminPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / take) || 1);
  const current = total === 0 ? 1 : Math.floor(skip / take) + 1;
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + take, total);
  const items = buildPageItems(current, pageCount);

  function goToPage(page: number) {
    const next = Math.min(Math.max(1, page), pageCount);
    onSkipChange((next - 1) * take);
  }

  if (total === 0) {
    return (
      <div className={cn("admin-pager", className)}>
        <p className="admin-pager__summary">Aucun résultat</p>
      </div>
    );
  }

  return (
    <div className={cn("admin-pager", className)}>
      <p className="admin-pager__summary">
        <strong>
          {from}–{to}
        </strong>{" "}
        sur <strong>{total}</strong>
        <span className="admin-pager__summary-sep" aria-hidden>
          ·
        </span>
        Page <strong>{current}</strong> / {pageCount}
      </p>

      <nav className="admin-pager__nav" aria-label="Pagination">
        <button
          type="button"
          className="admin-pager__btn"
          disabled={current <= 1}
          aria-label="Première page"
          title="Première page"
          onClick={() => goToPage(1)}
        >
          <ChevronsLeft size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="admin-pager__btn"
          disabled={current <= 1}
          aria-label="Page précédente"
          title="Précédent"
          onClick={() => goToPage(current - 1)}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>

        <div className="admin-pager__pages">
          {items.map((item, i) =>
            item === "…" ? (
              <span key={`e-${i}`} className="admin-pager__ellipsis" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={cn(
                  "admin-pager__page",
                  item === current && "admin-pager__page--active",
                )}
                aria-label={`Page ${item}`}
                aria-current={item === current ? "page" : undefined}
                onClick={() => goToPage(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          className="admin-pager__btn"
          disabled={current >= pageCount}
          aria-label="Page suivante"
          title="Suivant"
          onClick={() => goToPage(current + 1)}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="admin-pager__btn"
          disabled={current >= pageCount}
          aria-label="Dernière page"
          title="Dernière page"
          onClick={() => goToPage(pageCount)}
        >
          <ChevronsRight size={16} aria-hidden />
        </button>
      </nav>
    </div>
  );
}
