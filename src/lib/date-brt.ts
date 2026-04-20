/**
 * Date helpers that always operate in America/Sao_Paulo timezone (BRT, UTC-03:00).
 *
 * All date strings handled here are ISO date format (YYYY-MM-DD), which is how
 * Postgres `date` columns (e.g. invoices.due_date, clients.due_date) are returned.
 *
 * IMPORTANT: do NOT use `new Date("YYYY-MM-DD")` — JS parses that as UTC midnight,
 * which becomes the previous day in BRT (UTC-3). Always go through these helpers.
 */

const BRT_TZ = "America/Sao_Paulo";

/** Returns YYYY-MM-DD for "today" in São Paulo time. */
export function getTodayBRT(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/** Returns YYYY-MM-DD for `today + offsetDays` in São Paulo time. */
export function shiftDateBRT(offsetDays: number): string {
  const today = getTodayBRT();
  const [y, m, d] = today.split("-").map(Number);
  // Build a UTC anchor at noon to avoid DST edge cases, then shift by days.
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + offsetDays);
  const yy = anchor.getUTCFullYear();
  const mm = String(anchor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(anchor.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Formats an ISO date (YYYY-MM-DD) as DD/MM/YYYY in BRT.
 * Anchors at noon to avoid timezone shifts changing the day.
 */
export function formatDateBRT(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const onlyDate = isoDate.length >= 10 ? isoDate.slice(0, 10) : isoDate;
  const [y, m, d] = onlyDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/**
 * Formats a full timestamp (ISO with time, e.g. message_logs.sent_at) as
 * DD/MM/YYYY HH:mm in São Paulo time, regardless of the viewer's timezone.
 */
export function formatDateTimeBRT(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "—";
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(date).replace(",", "");
}

/**
 * Compares two ISO date strings (YYYY-MM-DD) lexicographically — safe because
 * the format is zero-padded. Returns -1/0/1 like a normal comparator.
 */
export function compareIsoDate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
