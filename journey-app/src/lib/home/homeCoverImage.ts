import { slugify } from "@/lib/utils";

/** Public URL prefix for per-journey Home poster backgrounds (under `public/home/covers/`). */
export const HOME_COVER_IMAGE_PUBLIC_DIR = "/home/covers";

/** Style spec for agent image generation — keep in sync with import prompt. */
export const HOME_COVER_IMAGE_STYLE =
  "minimal 3D illustration, orthographic projection, soft blue-and-white palette, clean enterprise tech aesthetic, gentle ambient light, no text, no logos, no people, abstract product metaphor";

export const HOME_COVER_IMAGE_ASPECT = "portrait 2:3 (e.g. 768×1152 px)";

export const HOME_JOURNEY_CUSTOM_COVER_GLOW = "37 99 235";

export function suggestHomeCoverFilename(title: string): string {
  const base = slugify(title || "journey").slice(0, 48) || "journey";
  return `${base}.png`;
}

export function suggestHomeCoverPublicPath(title: string): string {
  return `${HOME_COVER_IMAGE_PUBLIC_DIR}/${suggestHomeCoverFilename(title)}`;
}

/** Only allow static assets under `public/home/covers/` (no traversal). */
export function normalizeHomeCoverImagePath(path: string | undefined | null): string | null {
  const p = path?.trim();
  if (!p) return null;
  if (!p.startsWith(`${HOME_COVER_IMAGE_PUBLIC_DIR}/`)) return null;
  if (/\.\./.test(p) || /\\/.test(p)) return null;
  if (!/\.(png|webp|jpg|jpeg)$/i.test(p)) return null;
  return p;
}