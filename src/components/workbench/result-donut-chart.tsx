"use client";

import { useMemo, useState } from "react";

export interface ResultData {
  include: number;
  exclude: number;
  uncertain: number;
  conflict: number;
  partial: number;
  unreviewed: number;
}

interface Segment {
  key: keyof ResultData;
  label: string;
  color: string;
  count: number;
}

const SEGMENTS_CONFIG: Array<Omit<Segment, "count">> = [
  { key: "include",   label: "Included",         color: "var(--included)" },
  { key: "exclude",   label: "Excluded",          color: "var(--excluded)" },
  { key: "uncertain", label: "Uncertain",         color: "#f59e0b" },
  { key: "conflict",  label: "Conflict",          color: "#ef4444" },
  { key: "partial",   label: "Partial review",    color: "var(--pending)" },
  { key: "unreviewed",label: "Unreviewed",        color: "var(--border)" },
];

const R = 54;       // outer radius
const r = 32;       // inner radius
const CX = 70;
const CY = 70;
const SIZE = 140;

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const o1 = polarToCartesian(cx, cy, outerR, startAngle);
  const o2 = polarToCartesian(cx, cy, outerR, endAngle);
  const i1 = polarToCartesian(cx, cy, innerR, endAngle);
  const i2 = polarToCartesian(cx, cy, innerR, startAngle);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ");
}

interface ResultDonutChartProps {
  data: ResultData;
}

export function ResultDonutChart({ data }: ResultDonutChartProps) {
  const [hoveredKey, setHoveredKey] = useState<keyof ResultData | null>(null);

  const { segments, total } = useMemo(() => {
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    const segments: Array<Segment & { startAngle: number; endAngle: number }> = [];
    let currentAngle = 0;
    for (const cfg of SEGMENTS_CONFIG) {
      const count = data[cfg.key];
      if (count === 0) continue;
      const angle = (count / total) * 360;
      segments.push({
        ...cfg,
        count,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      });
      currentAngle += angle;
    }
    return { segments, total };
  }, [data]);

  const hovered = segments.find((s) => s.key === hoveredKey);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
        No data
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Donut SVG */}
      <div className="relative flex-shrink-0">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {segments.map((seg) => {
            const isHovered = hoveredKey === seg.key;
            const gap = 1.2;
            return (
              <path
                key={seg.key}
                d={arcPath(CX, CY, isHovered ? R + 4 : R, r, seg.startAngle + gap / 2, seg.endAngle - gap / 2)}
                fill={seg.color}
                opacity={hoveredKey === null || isHovered ? 1 : 0.45}
                style={{ transition: "opacity 0.15s, d 0.15s", cursor: "default" }}
                onMouseEnter={() => setHoveredKey(seg.key)}
                onMouseLeave={() => setHoveredKey(null)}
              />
            );
          })}
          {/* Center label */}
          {hovered ? (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" fontSize={18} fontWeight={700} fill={hovered.color}>
                {hovered.count}
              </text>
              <text x={CX} y={CY + 10} textAnchor="middle" fontSize={8} fill="var(--text-muted)">
                {((hovered.count / total) * 100).toFixed(0)}%
              </text>
            </>
          ) : (
            <>
              <text x={CX} y={CY - 6} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--text-primary)">
                {total}
              </text>
              <text x={CX} y={CY + 10} textAnchor="middle" fontSize={8} fill="var(--text-muted)">
                total
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="flex items-center gap-2 cursor-default"
            onMouseEnter={() => setHoveredKey(seg.key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{ opacity: hoveredKey === null || hoveredKey === seg.key ? 1 : 0.45, transition: "opacity 0.15s" }}
          >
            <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: seg.color }} />
            <span className="text-xs text-[var(--text-muted)]">{seg.label}</span>
            <span className="ml-auto pl-3 text-xs font-semibold tabular-nums" style={{ color: seg.color }}>
              {seg.count}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-8 text-right">
              {((seg.count / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
