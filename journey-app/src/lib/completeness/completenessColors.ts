/** M3-style bar / label: red (low) → green (high). */
export function completenessBarColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100;
  const hue = t * 142;
  return `hsl(${hue} 62% 40%)`;
}

export function completenessTrackColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100;
  const hue = t * 142;
  return `hsl(${hue} 35% 91%)`;
}