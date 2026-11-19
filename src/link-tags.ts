import type { ClyptLink } from "./types.js";

/**
 * Requested tag names that a created link does not carry. Clypt servers that
 * predate tag names in POST /links read only `tagIds` and ignore `tags`, so
 * the tools report the difference instead of implying the tags were applied.
 */
export function missingTags(
  requested: string[] | undefined,
  link: Pick<ClyptLink, "tags">
): string[] {
  const applied = new Set((link.tags ?? []).map((tag) => tag.name));
  const missing = (requested ?? [])
    .map((name) => name.trim())
    .filter((name) => name !== "" && !applied.has(name));
  return Array.from(new Set(missing));
}

export function tagsNotAppliedWarning(names: string[], target: string): string {
  return `Tags not applied: ${names.join(", ")}. The Clypt server did not attach them to the ${target}; add them in the Clypt dashboard.`;
}
