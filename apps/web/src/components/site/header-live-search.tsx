"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  articlesPublicApi,
  type PublicArticleCard,
} from "@/lib/api";

const ICON = { size: 18, strokeWidth: 1.75 } as const;
const DEBOUNCE_MS = 280;
const TAKE = 10;
const COVER_FALLBACK = "/legacy/articles/1591543587.jpg";

type Props = {
  variant: "header" | "menu";
  onNavigate?: () => void;
};

export function HeaderLiveSearch({ variant, onNavigate }: Props) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PublicArticleCard[]>([]);
  const [suggestions, setSuggestions] = useState<PublicArticleCard[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const reqId = useRef(0);

  const trimmed = query.trim();
  const isSearch = trimmed.length >= 2;
  const list = isSearch ? items : suggestions;
  const showPanel = open;
  const panelTitle = isSearch ? null : "Suggestions";

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await articlesPublicApi.random(TAKE);
      setSuggestions(res.items);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (q: string) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await articlesPublicApi.search(q, TAKE);
      if (id !== reqId.current) return;
      setItems(res.items);
      setTotal(res.total);
      setActiveIndex(-1);
    } catch {
      if (id !== reqId.current) return;
      setItems([]);
      setTotal(0);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!isSearch) {
      void loadSuggestions();
      return;
    }
    const t = window.setTimeout(() => {
      void runSearch(trimmed);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [open, isSearch, trimmed, loadSuggestions, runSearch]);

  useEffect(() => {
    if (!showPanel) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showPanel]);

  function openPanel() {
    setOpen(true);
  }

  function goResults() {
    if (!trimmed) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/recherche?q=${encodeURIComponent(trimmed)}`);
  }

  function goArticle(slug: string) {
    setOpen(false);
    setQuery("");
    setItems([]);
    onNavigate?.();
    router.push(`/article/${encodeURIComponent(slug)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && list[activeIndex]) {
      goArticle(list[activeIndex]!.slug);
      return;
    }
    if (isSearch) goResults();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showPanel) return;
    const extra = isSearch ? 1 : 0;
    const count = list.length + (isSearch && (total > 0 || list.length > 0) ? extra : 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (count === 0) return;
      setActiveIndex((i) => (i + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (count === 0) return;
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const rootClass =
    variant === "header" ? "opt-header__search-wrap" : "opt-menu__search-wrap";
  const formClass =
    variant === "header" ? "opt-header__search" : "opt-menu__search";
  const btnClass =
    variant === "header" ? "opt-header__search-btn" : undefined;

  return (
    <div ref={rootRef} className={rootClass}>
      <form
        className={formClass}
        onSubmit={onSubmit}
        role="search"
        onClick={openPanel}
      >
        <input
          type="search"
          name="q"
          placeholder="Rechercher…"
          value={query}
          autoComplete="off"
          aria-label="Rechercher"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showPanel}
          onFocus={openPanel}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className={btnClass}
          aria-label="Lancer la recherche"
        >
          <Search {...ICON} aria-hidden />
        </button>
      </form>

      {showPanel ? (
        <div
          id={listId}
          className="opt-search-live"
          role="listbox"
          aria-label="Suggestions de recherche"
        >
          {panelTitle ? (
            <p className="opt-search-live__heading">{panelTitle}</p>
          ) : null}

          {loading && list.length === 0 ? (
            <p className="opt-search-live__empty">Chargement…</p>
          ) : list.length === 0 ? (
            <p className="opt-search-live__empty">
              {isSearch ? "Aucun article trouvé" : "Aucune suggestion"}
            </p>
          ) : (
            <ul className="opt-search-live__list">
              {list.map((item, index) => (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={activeIndex === index}
                >
                  <button
                    type="button"
                    className={
                      activeIndex === index
                        ? "opt-search-live__item is-active"
                        : "opt-search-live__item"
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => goArticle(item.slug)}
                  >
                    <span className="opt-search-live__cover">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.coverUrl || COVER_FALLBACK}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = COVER_FALLBACK;
                        }}
                      />
                    </span>
                    <span className="opt-search-live__meta">
                      <span className="opt-search-live__title">{item.title}</span>
                      {item.categoryLabel ? (
                        <span className="opt-search-live__cat">
                          {item.categoryLabel}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isSearch ? (
            <button
              type="button"
              className={
                activeIndex === list.length
                  ? "opt-search-live__more is-active"
                  : "opt-search-live__more"
              }
              onMouseEnter={() => setActiveIndex(list.length)}
              onClick={goResults}
            >
              Voir tous les résultats
              {total > 0 ? ` (${total})` : ""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
