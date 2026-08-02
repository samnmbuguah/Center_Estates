export function resolveTourTargetSelector(preferredTarget?: string, fallbackTarget?: string): string | undefined {
  if (!preferredTarget && !fallbackTarget) return undefined;

  if (preferredTarget) {
    const preferredExists = typeof document !== "undefined" && document.querySelector(preferredTarget) !== null;
    if (preferredExists) return preferredTarget;
  }

  return fallbackTarget;
}
