"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { completenessBarColor } from "@/lib/completeness/completenessColors";

export function CompletenessDonut({
  score,
  depth,
  size = "md",
  metricLabel,
}: {
  score: number;
  depth?: string;
  size?: "md" | "sm";
  /** Shown under the % when `depth` is omitted (e.g. home card completeness). */
  metricLabel?: string;
}) {
  const sm = size === "sm";
  const data = [
    { name: "Complete", value: score },
    { name: "Remaining", value: 100 - score },
  ];
  const fill = completenessBarColor(score);
  const ariaLabel = metricLabel
    ? `${metricLabel} ${score}%`
    : depth
      ? `Journey completeness ${score}%, ${depth}`
      : `Journey completeness ${score}%`;
  return (
    <div
      className={`relative mx-auto shrink-0 ${sm ? "h-[7.5rem] w-[7.5rem]" : "h-44 w-44"}`}
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={sm ? 36 : 52}
            outerRadius={sm ? 46 : 68}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
          >
            <Cell fill={fill} />
            <Cell fill="#e2e8f0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-bold tabular-nums ${sm ? "text-base" : "text-xl"}`}
          style={{ color: fill }}
        >
          {score}%
        </span>
        {depth ? (
          <span className="summary-kpi-label normal-case tracking-wide">{depth}</span>
        ) : metricLabel ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">{metricLabel}</span>
        ) : null}
      </div>
    </div>
  );
}