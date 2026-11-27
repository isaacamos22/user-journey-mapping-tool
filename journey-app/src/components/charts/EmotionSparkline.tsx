"use client";

import { useRef } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { EMOTION_SERIES, NEUTRAL_BAND } from "@/lib/charts/chartSemantics";
import { pickChartSize, useChartLayout, type ChartLayoutSize } from "@/components/charts/useChartLayout";
import {
  CHART_AXIS_FILL,
  CHART_AXIS_FONT_PX,
  CHART_LEGEND_FONT_PX,
} from "@/lib/typography/chartTypography";

type Point = {
  stepId?: string;
  name: string;
  fullTitle?: string;
  confidence: number;
  frustration: number;
  delight: number;
};

function EmotionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string; name: string; payload?: Point }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const fullTitle = payload[0]?.payload?.fullTitle;
  const seen = new Set<string>();
  const rows = payload.filter((p) => {
    const k = String(p.dataKey);
    if (seen.has(k)) return false;
    seen.add(k);
    return typeof p.value === "number";
  });
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-md max-w-xs m3-body">
      <p className="font-semibold text-foreground mb-1">{fullTitle || label}</p>
      <ul className="space-y-0.5">
        {rows.map((p) => (
          <li key={String(p.dataKey)} className="flex justify-between gap-4">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-medium tabular-nums">{p.value.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const EMOTION_HEIGHT: Record<ChartLayoutSize, string> = {
  compact: "h-[11rem]",
  default: "h-52",
  lg: "h-[15.5rem]",
};

export function EmotionSparkline({
  data,
  compact,
  size,
  onStepSelect,
}: {
  data: Point[];
  compact?: boolean;
  size?: ChartLayoutSize;
  onStepSelect?: (stepId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, size: observed } = useChartLayout(containerRef);

  if (!data.length) {
    return <p className="text-sm text-muted">Add thoughts &amp; feelings per step to see the trend.</p>;
  }

  const resolved = pickChartSize(size, compact, observed);
  const tickSize = CHART_AXIS_FONT_PX;
  const crowded = data.length > 6 || width < 560;
  const xAngle = width < 380 ? -40 : width < 560 ? -32 : resolved === "lg" ? -22 : -26;
  const xHeight = width < 380 ? 56 : width < 560 ? 52 : resolved === "lg" ? 50 : 46;
  const xInterval = crowded ? "preserveStartEnd" : 0;

  return (
    <div
      ref={containerRef}
      className={`min-w-0 w-full ${EMOTION_HEIGHT[resolved]} ${onStepSelect ? "cursor-pointer" : ""}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: xHeight > 48 ? 4 : 0 }}
          onClick={(state) => {
            const active = (state as { activePayload?: Array<{ payload?: Point }> } | null)?.activePayload;
            const stepId = active?.[0]?.payload?.stepId;
            if (stepId && onStepSelect) onStepSelect(stepId);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: tickSize, fill: CHART_AXIS_FILL }}
            interval={xInterval}
            angle={xAngle}
            textAnchor="end"
            height={xHeight}
            minTickGap={width < 560 ? 4 : 8}
          />
          <YAxis
            domain={[1, 7]}
            tick={{ fontSize: tickSize, fill: CHART_AXIS_FILL }}
            ticks={resolved === "compact" ? [1, 4, 7] : [1, 2, 3, 4, 5, 6, 7]}
            width={resolved === "compact" ? 24 : 28}
          />
          <ReferenceLine y={NEUTRAL_BAND.y} stroke={NEUTRAL_BAND.stroke} strokeDasharray="4 4" />
          <Tooltip content={<EmotionTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={32}
            iconType="circle"
            iconSize={resolved === "compact" ? 6 : 8}
            wrapperStyle={{ fontSize: CHART_LEGEND_FONT_PX, color: CHART_AXIS_FILL, paddingTop: 6 }}
          />
          <Area
            type="monotone"
            dataKey="delight"
            fill={EMOTION_SERIES.delight.fill}
            stroke="none"
            name={EMOTION_SERIES.delight.label}
            legendType="none"
            tooltipType="none"
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="confidence"
            stroke={EMOTION_SERIES.confidence.stroke}
            strokeWidth={2.5}
            dot={{ r: resolved === "compact" ? 2 : 3, fill: EMOTION_SERIES.confidence.stroke }}
            activeDot={{ r: 5 }}
            name={EMOTION_SERIES.confidence.label}
          />
          <Line
            type="monotone"
            dataKey="frustration"
            stroke={EMOTION_SERIES.frustration.stroke}
            strokeWidth={2.5}
            dot={{ r: resolved === "compact" ? 2 : 3, fill: EMOTION_SERIES.frustration.stroke }}
            activeDot={{ r: 5 }}
            name={EMOTION_SERIES.frustration.label}
          />
          <Line
            type="monotone"
            dataKey="delight"
            stroke={EMOTION_SERIES.delight.stroke}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            name={EMOTION_SERIES.delight.label}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}