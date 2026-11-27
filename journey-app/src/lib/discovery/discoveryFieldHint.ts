/** Cursor tooltip target + a11y hint (see `DiscoveryFieldHintLayer`). */
export function discoveryFieldHint(placeholder?: string) {
  const hint = placeholder?.trim();
  if (!hint) return {};
  return { "data-discovery-field-hint": hint, "aria-description": hint } as const;
}