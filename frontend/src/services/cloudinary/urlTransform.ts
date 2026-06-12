/**
 * Cloudinary Delivery URL Optimization
 *
 * Transforms raw Cloudinary `secure_url` values into optimized delivery URLs
 * by injecting transformation segments at runtime.
 *
 * - Only transforms URLs that match the Cloudinary `/upload/` pattern.
 * - Non-Cloudinary URLs (e.g. legacy Supabase Storage URLs) pass through unchanged.
 * - Database records are NEVER modified — this is a pure runtime optimization.
 */

// ─── Regex to match Cloudinary upload URLs ────────────────────────────────────
// Matches:  https://res.cloudinary.com/<cloud>/video/upload/v1234567890/file.mp4
//           https://res.cloudinary.com/<cloud>/image/upload/v1234567890/file.jpg
// Captures: everything before `/upload/` and everything after (including `/v...`)
const CLOUDINARY_UPLOAD_RE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/upload)(\/v\d+\/.+)$/;

// ─── Transformation presets ───────────────────────────────────────────────────

/** Video: auto format, auto quality, cap bitrate to 1 Mbps, cap width to 720px */
const VIDEO_TRANSFORMS = 'f_auto,q_auto,br_1m,w_720';

/** Thumbnail: auto format, auto quality, 400px wide, crop to fill */
const THUMBNAIL_TRANSFORMS = 'f_auto,q_auto,w_400,c_fill';

/** Avatar: auto format, auto quality, 100px wide, crop to fill, focus on face */
const AVATAR_TRANSFORMS = 'f_auto,q_auto,w_100,c_fill,g_face';

// ─── Core transform function ─────────────────────────────────────────────────

/**
 * Injects Cloudinary transformation parameters into a raw upload URL.
 *
 * @param url           The raw Cloudinary `secure_url` from the database
 * @param transforms    The transformation string to inject (e.g. `f_auto,q_auto`)
 * @returns             The optimized delivery URL, or the original URL if not a Cloudinary upload URL
 */
function applyTransform(url: string | null | undefined, transforms: string): string | null {
  if (!url) return null;

  const match = url.match(CLOUDINARY_UPLOAD_RE);
  if (!match) {
    // Not a Cloudinary upload URL — return as-is (backward compatible)
    return url;
  }

  // Insert transforms between /upload and /v<version>/...
  return `${match[1]}/${transforms}${match[2]}`;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns an optimized Cloudinary delivery URL for video playback.
 * Non-Cloudinary URLs pass through unchanged.
 */
export function optimizeVideoUrl(url: string): string {
  return applyTransform(url, VIDEO_TRANSFORMS) ?? url;
}

/**
 * Returns an optimized Cloudinary delivery URL for thumbnail images.
 * Non-Cloudinary URLs pass through unchanged.
 */
export function optimizeThumbnailUrl(url: string | null): string | null {
  return applyTransform(url, THUMBNAIL_TRANSFORMS);
}

/**
 * Returns an optimized Cloudinary delivery URL for avatar images.
 * Non-Cloudinary URLs pass through unchanged.
 */
export function optimizeAvatarUrl(url: string | null): string | null {
  return applyTransform(url, AVATAR_TRANSFORMS);
}
