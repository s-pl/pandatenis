/**
 * Generate a deterministic DiceBear avatar URL — same approach Badgie uses
 * for users without a custom profile picture.
 *
 * Pixel-art is the default style (matches Badgie's look). Use a stable seed
 * (e.g. `${id}-${firstName}-${lastName}`) so the avatar stays consistent
 * across reloads.
 */
export type AvatarStyle =
  | "pixel-art"
  | "pixel-art-neutral"
  | "adventurer"
  | "adventurer-neutral"
  | "lorelei"
  | "lorelei-neutral"
  | "thumbs"
  | "fun-emoji"
  | "bottts";

export function avatarUrl(
  seed: string,
  style: AvatarStyle = "pixel-art",
  options?: { size?: number; backgroundType?: "solid" | "gradientLinear" },
): string {
  const cleanSeed = encodeURIComponent(seed?.trim() || "user");
  const params = new URLSearchParams();
  if (options?.size) params.set("size", String(options.size));
  if (options?.backgroundType)
    params.set("backgroundType", options.backgroundType);
  const qs = params.toString();
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${cleanSeed}${qs ? `&${qs}` : ""}`;
}

/** Build a stable seed from a person's identity fields. */
export function buildAvatarSeed(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join("-").toLowerCase();
}
