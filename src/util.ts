/** Small shared helpers used by the config loader, renderer and interactions. */

/** Zero-pad a number: `pad(3)` → `"03"`. */
export const pad = (value: number, length = 2): string =>
  String(value).padStart(length, '0');

/**
 * Whole calendar days between an ISO date (`YYYY-MM-DD`) and today, in the
 * visitor's local time zone. Returns 0 for an invalid date.
 */
export const daysSince = (iso: string): number => {
  const start = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const now = new Date();
  const startDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((nowDay - startDay) / 86_400_000);
};
