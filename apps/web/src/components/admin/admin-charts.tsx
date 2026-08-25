"use client";

import { useId, useMemo, useState } from "react";

type Point = {
  label: string;
  value: number;
  count?: number;
};

function formatMoneyCompact(n: number, currency = "USD"): string {
  if (n >= 1000) {
    return `${new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 1,
    }).format(n / 1000)} k${currency === "EUR" ? "€" : "$"}`;
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatMoney(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

export function AdminBarChart({
  title,
  points,
  color = "#0565ab",
  currency = "USD",
}: {
  title: string;
  points: Point[];
  color?: string;
  currency?: string;
}) {
  const gradId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const total = useMemo(
    () => points.reduce((s, p) => s + p.value, 0),
    [points],
  );
  const txCount = useMemo(
    () => points.reduce((s, p) => s + (p.count ?? 0), 0),
    [points],
  );
  const max = Math.max(...points.map((p) => p.value), 1);
  const hasData = points.some((p) => p.value > 0);

  const w = 560;
  const h = 240;
  const pad = { t: 20, r: 16, b: 42, l: 48 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const gap = 5;
  const barW = Math.max(
    10,
    (innerW - gap * Math.max(points.length - 1, 0)) / Math.max(points.length, 1),
  );

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.t + innerH * (1 - t),
    value: max * t,
  }));

  return (
    <section className="admin-dash__panel admin-chart">
      <div className="admin-dash__panel-head">
        <div>
          <h2>{title}</h2>
          <p className="admin-chart__sub">
            Total {formatMoney(total, currency)}
            {txCount > 0 ? ` · ${txCount} paiement${txCount > 1 ? "s" : ""}` : ""}
          </p>
        </div>
        {hover != null && points[hover] ? (
          <div className="admin-chart__tip">
            <strong>{formatMoney(points[hover].value, currency)}</strong>
            <span>
              {points[hover].label}
              {points[hover].count != null
                ? ` · ${points[hover].count} tx`
                : ""}
            </span>
          </div>
        ) : null}
      </div>

      {!hasData ? (
        <p className="admin-chart__empty">
          Aucun volume payé sur les 14 derniers jours.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="admin-chart__svg"
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={`bar-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={pad.l}
                x2={w - pad.r}
                y1={tick.y}
                y2={tick.y}
                className="admin-chart__grid"
              />
              <text
                x={pad.l - 8}
                y={tick.y + 3}
                textAnchor="end"
                className="admin-chart__axis"
              >
                {formatMoneyCompact(tick.value, currency)}
              </text>
            </g>
          ))}

          {points.map((p, i) => {
            const bh = (p.value / max) * innerH;
            const x = pad.l + i * (barW + gap);
            const y = pad.t + innerH - bh;
            const active = hover === i;
            return (
              <g
                key={`${p.label}-${i}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={x}
                  y={pad.t}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(bh, p.value > 0 ? 4 : 2)}
                  rx={7}
                  fill={`url(#bar-${gradId})`}
                  opacity={active ? 1 : 0.9}
                />
                {active && p.value > 0 ? (
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    textAnchor="middle"
                    className="admin-chart__bar-value"
                  >
                    {formatMoneyCompact(p.value, currency)}
                  </text>
                ) : null}
                <text
                  x={x + barW / 2}
                  y={h - 14}
                  textAnchor="middle"
                  className="admin-chart__axis"
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}

export function AdminDonutChart({
  title,
  slices,
  unitLabel = "paiements",
}: {
  title: string;
  slices: Array<{ label: string; value: number; color: string }>;
  unitLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const hasData = total > 0;
  const r = 58;
  const stroke = 20;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const enriched = slices.map((s) => ({
    ...s,
    pct: total > 0 ? Math.round((s.value / total) * 100) : 0,
  }));

  return (
    <section className="admin-dash__panel admin-chart">
      <div className="admin-dash__panel-head">
        <div>
          <h2>{title}</h2>
          <p className="admin-chart__sub">
            {hasData
              ? `${total} ${unitLabel}`
              : "Pas encore de données"}
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="admin-chart__empty">
          Aucune répartition disponible pour le moment.
        </p>
      ) : (
        <div className="admin-chart__donut-wrap">
          <svg viewBox="0 0 160 160" className="admin-chart__donut" role="img">
            <circle
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              className="admin-chart__donut-track"
            />
            <g transform="translate(80,80) rotate(-90)">
              {enriched.map((slice, i) => {
                const len = (slice.value / total) * c;
                const el = (
                  <circle
                    key={slice.label}
                    r={r}
                    cx={0}
                    cy={0}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={hover === i ? stroke + 4 : stroke}
                    strokeDasharray={`${len} ${c - len}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                    opacity={hover == null || hover === i ? 1 : 0.35}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
                  />
                );
                offset += len;
                return el;
              })}
            </g>
            <text
              x="80"
              y="74"
              textAnchor="middle"
              className="admin-chart__center"
            >
              {hover != null ? enriched[hover]?.pct : total}
              {hover != null ? "%" : ""}
            </text>
            <text
              x="80"
              y="94"
              textAnchor="middle"
              className="admin-chart__center-label"
            >
              {hover != null ? enriched[hover]?.label : "total"}
            </text>
          </svg>

          <ul className="admin-chart__legend">
            {enriched.map((s, i) => (
              <li
                key={s.label}
                className={
                  hover === i
                    ? "admin-chart__legend-item admin-chart__legend-item--on"
                    : "admin-chart__legend-item"
                }
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span style={{ background: s.color }} />
                <div>
                  <strong>{s.label}</strong>
                  <em>
                    {s.value} · {s.pct}%
                  </em>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
