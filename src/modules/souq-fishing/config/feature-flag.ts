/**
 * Feature Flag Configuration for Souq & Fishing Game Module.
 * Governs whether the module is active, exposed in the game registry,
 * or mounted to projector/controller pages.
 */

export const FEATURE_FLAG_ENV_KEY = "NEXT_PUBLIC_ENABLE_SOUQ_FISHING_MODULE";

/**
 * Returns true if the Souq & Fishing module is enabled.
 * Defaults to true for development if env is undefined or "true",
 * and strictly false if explicitly set to "false" or "0".
 */
export function isSouqFishingEnabled(): boolean {
  if (typeof process !== "undefined" && process.env) {
    const val =
      process.env[FEATURE_FLAG_ENV_KEY] ??
      process.env.ENABLE_SOUQ_FISHING_MODULE;
    if (val === "false" || val === "0") {
      return false;
    }
    if (val === "true" || val === "1") {
      return true;
    }
  }
  // Default to enabled unless explicitly turned off
  return true;
}
