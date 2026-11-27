"use client";

import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type ScaleSliderProps = {
  name: string;
  label: string;
  min?: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  tone?: "brand" | "warn" | "neutral" | "severity";
};

function severityPalette(value: number, min: number, max: number) {
  const t = max === min ? 0 : (value - min) / (max - min);
  const hue = 142 - t * 142;
  const fill = `hsl(${hue} 65% 42%)`;
  const track = `hsl(${hue} 55% 92%)`;
  return { fill, track, valueColor: fill };
}

export function ScaleSlider({
  name,
  label,
  min = 1,
  max = 7,
  value,
  onChange,
  hint,
  tone = "brand",
}: ScaleSliderProps) {
  const severity = tone === "severity" ? severityPalette(value, min, max) : null;
  const track =
    tone === "warn"
      ? "bg-amber-100"
      : tone === "neutral"
        ? "bg-slate-200"
        : tone === "severity"
          ? ""
          : "bg-brand-container";
  const range =
    tone === "warn"
      ? "bg-amber-600"
      : tone === "neutral"
        ? "bg-slate-600"
        : tone === "severity"
          ? ""
          : "bg-brand";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={name} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <span
          className="text-sm tabular-nums font-semibold text-brand"
          style={severity ? { color: severity.valueColor } : undefined}
          aria-live="polite"
        >
          {value}
        </span>
      </div>
      <input type="hidden" name={name} value={value} readOnly />
      <Slider.Root
        id={name}
        className="relative flex h-9 w-full touch-none select-none items-center"
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? min)}
      >
        <Slider.Track
          className={cn("relative h-2 grow rounded-full", track)}
          style={severity ? { backgroundColor: severity.track } : undefined}
        >
          <Slider.Range
            className={cn("absolute h-full rounded-full", range)}
            style={severity ? { backgroundColor: severity.fill } : undefined}
          />
        </Slider.Track>
        <Slider.Thumb
          className={cn(
            "block h-5 w-5 rounded-full border-2 border-white shadow-md focus:outline-none focus-visible:shadow-[var(--focus-ring)]",
            tone === "severity" ? "" : "bg-brand"
          )}
          style={severity ? { backgroundColor: severity.fill } : undefined}
          aria-label={label}
        />
      </Slider.Root>
      {hint ? <p className="m3-caption">{hint}</p> : null}
    </div>
  );
}