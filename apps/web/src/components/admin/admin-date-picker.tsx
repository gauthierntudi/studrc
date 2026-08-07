"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"] as const;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(y, m, day);
  if (
    d.getFullYear() !== y ||
    d.getMonth() !== m ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDisplay(iso: string): string {
  const d = parseIso(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function buildCells(month: Date): Array<Date | null> {
  const first = startOfMonth(month);
  // Monday-first: JS getDay() Sunday=0 → Monday=0
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export type AdminDatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
};

export function AdminDatePicker({
  label,
  value,
  onChange,
  min,
  max,
  placeholder = "Choisir…",
  className,
}: AdminDatePickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => (value ? parseIso(value) : null), [value]);
  const minDate = useMemo(() => (min ? parseIso(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseIso(max) : null), [max]);
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(selected ?? new Date()),
  );

  useEffect(() => {
    if (open) {
      setMonth(startOfMonth(selected ?? new Date()));
    }
  }, [open, selected]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => buildCells(month), [month]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  function isDisabled(d: Date): boolean {
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  }

  function pick(d: Date) {
    if (isDisabled(d)) return;
    onChange(toIso(d));
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "admin-dash__field admin-dash__field--date admin-datepicker",
        className,
      )}
    >
      <span id={`${id}-label`}>{label}</span>
      <div className="admin-datepicker__wrap">
        <button
          type="button"
          id={id}
          className={cn(
            "admin-datepicker__trigger",
            !value && "is-empty",
            open && "is-open",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${id}-label`}
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarDays size={15} strokeWidth={2} aria-hidden />
          <span>{value ? formatDisplay(value) : placeholder}</span>
        </button>
        {value ? (
          <button
            type="button"
            className="admin-datepicker__clear"
            aria-label="Effacer la date"
            onClick={() => onChange("")}
          >
            <X size={13} strokeWidth={2} aria-hidden />
          </button>
        ) : null}

        {open ? (
          <div
            className="admin-datepicker__popover"
            role="dialog"
            aria-label={`Calendrier — ${label}`}
          >
            <div className="admin-datepicker__nav">
              <button
                type="button"
                className="admin-datepicker__nav-btn"
                aria-label="Mois précédent"
                onClick={() => setMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden />
              </button>
              <p className="admin-datepicker__month">
                {MONTHS[month.getMonth()]} {month.getFullYear()}
              </p>
              <button
                type="button"
                className="admin-datepicker__nav-btn"
                aria-label="Mois suivant"
                onClick={() => setMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>

            <div className="admin-datepicker__weekdays" aria-hidden>
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="admin-datepicker__grid">
              {cells.map((d, i) =>
                d ? (
                  <button
                    key={toIso(d)}
                    type="button"
                    disabled={isDisabled(d)}
                    className={cn(
                      "admin-datepicker__day",
                      selected && sameDay(d, selected) && "is-selected",
                      sameDay(d, today) && "is-today",
                    )}
                    onClick={() => pick(d)}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <span key={`e-${i}`} className="admin-datepicker__day is-empty" />
                ),
              )}
            </div>

            <div className="admin-datepicker__footer">
              <button
                type="button"
                className="admin-datepicker__today"
                onClick={() => {
                  const t = today;
                  if (!isDisabled(t)) pick(t);
                  else setMonth(startOfMonth(t));
                }}
              >
                Aujourd’hui
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
