"use client";

export function mapTextMatchesHighlight(item: string, highlight: string): boolean {
  const a = item.trim().toLowerCase();
  const b = highlight.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const n = Math.min(24, a.length, b.length);
  return n >= 10 && a.slice(0, n) === b.slice(0, n);
}

export function MapTextWithHighlight({
  text,
  highlight,
}: {
  text: string;
  highlight?: string | null;
}) {
  if (!highlight?.trim()) return <>{text}</>;
  const needle = highlight.trim();
  const hay = text;
  const idx = hay.toLowerCase().indexOf(needle.toLowerCase());
  if (idx >= 0) {
    return (
      <>
        {hay.slice(0, idx)}
        <mark className="journey-map-text-highlight">{hay.slice(idx, idx + needle.length)}</mark>
        {hay.slice(idx + needle.length)}
      </>
    );
  }
  if (mapTextMatchesHighlight(hay, needle)) {
    return <mark className="journey-map-text-highlight">{text}</mark>;
  }
  return <>{text}</>;
}