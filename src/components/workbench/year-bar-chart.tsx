"use client";

import { useMemo, useState } from "react";

interface YearBarChartProps {
  data: Array<[number, number]>; // [year, count]
}

const CHART_HEIGHT = 140;
const BAR_GAP = 3;
const LABEL_HEIGHT = 20;
const Y_AXIS_WIDTH = 28;
const PADDING_TOP = 12;

export function YearBarChart({ data }: YearBarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { bars, yTicks, svgWidth, totalHeight } = useMemo(() => {
    if (data.length === 0) return { bars: [], yTicks: [], svgWidth: 0, totalHeight: 0 };

    const maxCount = Math.max(...data.map(([, c]) => c));
    const yMax = Math.ceil(maxCount / 5) * 5 || 5;
    const yTicks = [0, Math.round(yMax / 2), yMax];

    const totalWidth = 480;
    const chartWidth = totalWidth - Y_AXIS_WIDTH;
    const barWidth = Math.max(6, (chartWidth - BAR_GAP * (data.length - 1)) / data.length);
    const svgWidth = Y_AXIS_WIDTH + data.length * barWidth + BAR_GAP * (data.length - 1);

    const bars = data.map(([year, count], i) => {
      const barH = (count / yMax) * CHART_HEIGHT;
      const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP);
      const y = PADDING_TOP + CHART_HEIGHT - barH;
      return { year, count, x, y, barH, barWidth };
    });

    return { bars, yTicks, svgWidth, totalHeight: PADDING_TOP + CHART_HEIGHT + LABEL_HEIGHT };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--text-muted)]">
        No year data available
      </div>
    );
  }

  // Decide which year labels to show to avoid overlap
  const step = bars.length > 12 ? Math.ceil(bars.length / 8) : 1;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", minWidth: Math.min(svgWidth, 200) }}
      >
        {/* Y-axis grid lines + ticks */}
        {yTicks.map((tick) => {
          const y = PADDING_TOP + CHART_HEIGHT - (tick / (yTicks[yTicks.length - 1] || 1)) * CHART_HEIGHT;
          return (
            <g key={tick}>
              <line
                x1={Y_AXIS_WIDTH}
                y1={y}
                x2={svgWidth}
                y2={y}
                stroke="var(--border)"
                strokeWidth={0.5}
                strokeDasharray={tick === 0 ? "none" : "3 3"}
              />
              <text
                x={Y_AXIS_WIDTH - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="var(--text-muted)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {bars.map((bar, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <g key={bar.year}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.barWidth}
                height={bar.barH}
                rx={2}
                fill={isHovered ? "var(--included)" : "var(--pending)"}
                opacity={isHovered ? 1 : 0.7}
                style={{ transition: "fill 0.15s, opacity 0.15s" }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
              {/* Hover count label */}
              {isHovered && (
                <text
                  x={bar.x + bar.barWidth / 2}
                  y={bar.y - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill="var(--included)"
                >
                  {bar.count}
                </text>
              )}
              {/* X-axis year label */}
              {i % step === 0 && (
                <text
                  x={bar.x + bar.barWidth / 2}
                  y={PADDING_TOP + CHART_HEIGHT + LABEL_HEIGHT - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isHovered ? "var(--included)" : "var(--text-muted)"}
                >
                  {bar.year}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
