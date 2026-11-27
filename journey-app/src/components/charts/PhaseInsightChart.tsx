"use client";

import { useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import type { SummaryPhaseInsight } from "@/lib/journey/buildSummaryMetrics";
import { EMOTION_SERIES } from "@/lib/charts/chartSemantics";
import { painSeverityColor } from "@/lib/charts/chartSemantics";
import { pickChartSize, useChartLayout, type ChartLayoutSize } from "@/components/charts/useChartLayout";
import {
  CHART_AXIS_FILL,
  CHART_AXIS_FONT_PX,
  CHART_LEGEND_FONT_PX,
} from "@/lib/typography/chartTypography";

export function PhaseInsightChart({
  data,
  compact,
  size,
}: {
  data: SummaryPhaseInsight[];
  compact?: boolean;
  size?: ChartLayoutSize;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width, size: observed } = useChartLayout(containerRef);
  const resolved = pickChartSize(size, compact, observed);

  if (!data.length) return null;

  const chartData = data.map((d) => ({
    ...d,
    avgPainSeverity: d.avgPainSeverity || 0,
    avgFrustration: d.avgFrustration || 0,
  }));

  const tickSize = CHART_AXIS_FONT_PX;
  const chartH =
    resolved === "lg" ? "min-h-[13rem] h-52" : resolved === "compact" ? "min-h-[10rem] h-40" : "min-h-[12rem] h-48";
  const slim = width < 560;
  const xAngle = slim ? -22 : 0;
  const xHeight = slim ? 48 : 30;
  const yWidth = slim ? 26 : 32;

  return (
    <div ref={containerRef} className={`min-w-0 w-full ${chartH}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: slim ? 4 : 12, left: 0, bottom: slim ? 8 : 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="phase"
            tick={{ fontSize: tickSize, fill: CHART_AXIS_FILL }}
            interval={data.length > 3 && slim ? "preserveStartEnd" : 0}
            angle={xAngle}
            textAnchor={slim ? "end" : "middle"}
            height={xHeight}
          />
          <YAxis yAxisId="left" domain={[0, 7]} tick={{ fontSize: tickSize }} width={yWidth} />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 5]}
            tick={{ fontSize: tickSize, fill: CHART_AXIS_FILL }}
            width={yWidth}
          />
          <Tooltip labelFormatter={(label) => `Phase: ${label}`} />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: CHART_LEGEND_FONT_PX, color: CHART_AXIS_FILL, paddingTop: 4 }}
            verticalAlign="bottom"
          />
          <Bar
            yAxisId="left"
            dataKey="avgFrustration"
            name="Avg frustration"
            fill={EMOTION_SERIES.frustration.stroke}
            radius={[4, 4, 0, 0]}
            maxBarSize={slim ? 24 : 32}
          />
          <Bar
            yAxisId="right"
            dataKey="avgPainSeverity"
            name="Avg pain severity"
            fill="#94a3b8"
            radius={[4, 4, 0, 0]}
            maxBarSize={slim ? 24 : resolved === "lg" ? 40 : 32}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.avgPainSeverity > 0
                    ? painSeverityColor(Math.round(entry.avgPainSeverity))
                    : "#cbd5e1"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}