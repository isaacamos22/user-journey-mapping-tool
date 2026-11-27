"use client";

import { useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { painSeverityColor, painSeverityLabel } from "@/lib/charts/chartSemantics";
import { pickChartSize, useChartLayout, type ChartLayoutSize } from "@/components/charts/useChartLayout";
import { CHART_AXIS_FILL, CHART_AXIS_FONT_PX } from "@/lib/typography/chartTypography";

type Row = { stepId?: string; step: string; severity: number; count?: number; topPain?: string };

type ChartRow = Row & { stepShort: string };

function shortStepLabel(step: string, max: number) {
  const oneLine = step.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, Math.max(8, max - 1))}…`;
}

function PainTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]!.payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-md max-w-sm">
      <p className="font-semibold text-fg leading-snug">{row.step}</p>
      <p className="mt-1 text-xs text-muted">
        Severity {row.severity} · {painSeverityLabel(row.severity)}
        {row.count && row.count > 1 ? ` · ${row.count} pains` : null}
      </p>
      {row.topPain ? <p className="mt-1 text-sm text-fg/90 line-clamp-4">{row.topPain}</p> : null}
    </div>
  );
}

export function PainHeatmap({
  data,
  compact,
  size,
  onStepSelect,
}: {
  data: Row[];
  compact?: boolean;
  size?: ChartLayoutSize;
  onStepSelect?: (stepId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, size: observed } = useChartLayout(containerRef);
  const resolved = pickChartSize(size, compact, observed);

  const labelMax =
    width < 380 ? 22 : width < 520 ? 28 : resolved === "lg" ? 40 : 32;
  const yWidth = Math.round(Math.min(156, Math.max(72, width * 0.36)));
  const rowPitch = resolved === "lg" ? 34 : resolved === "compact" ? 24 : 28;
  const tickSize = CHART_AXIS_FONT_PX;
  const barSize = resolved === "lg" ? 18 : resolved === "compact" ? 11 : 14;

  const chartRows = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        stepShort: shortStepLabel(d.step, labelMax),
      })),
    [data, labelMax]
  );

  if (!chartRows.length) return <p className="text-sm text-muted">No pain points captured yet.</p>;

  const chartH = Math.min(chartRows.length * rowPitch + 32, resolved === "compact" ? 320 : 520);

  return (
    <div
      ref={containerRef}
      className={`min-w-0 w-full min-h-[10rem] ${onStepSelect ? "cursor-pointer" : ""}`}
      style={{ height: chartH }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartRows}
          layout="vertical"
          margin={{ left: 4, right: 8, top: 6, bottom: 6 }}
        >
          <XAxis
            type="number"
            domain={[0, 5]}
            ticks={width < 400 ? [0, 2, 4, 5] : [0, 1, 2, 3, 4, 5]}
            tick={{ fontSize: tickSize, fill: CHART_AXIS_FILL }}
          />
          <YAxis
            type="category"
            dataKey="stepShort"
            width={yWidth}
            tick={{ fontSize: tickSize, fill: CHART_AXIS_FILL }}
            interval={0}
            tickMargin={4}
          />
          <Tooltip content={<PainTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.15)" }} />
          <Bar
            dataKey="severity"
            name="Severity"
            radius={[0, 4, 4, 0]}
            barSize={barSize}
            onClick={(_bar, index) => {
              const row = chartRows[index];
              if (row?.stepId && onStepSelect) onStepSelect(row.stepId);
            }}
          >
            {chartRows.map((entry, i) => (
              <Cell key={i} fill={painSeverityColor(entry.severity)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}