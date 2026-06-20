// Shared formatting helpers.

/** OpenDental stores colors as .NET ARGB ints (often negative). Convert to CSS hex. */
export function argbToHex(argb?: number | null, fallback = "#94a3b8"): string {
  if (argb == null || argb === 0) return fallback;
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  // White is OpenDental's "no color"; map it to the fallback so cards stay readable.
  if (r === 255 && g === 255 && b === 255) return fallback;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

export function fmtDate(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1) return "";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtTime(s?: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1) return "";
  return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

export function fmtDateTime(s?: string | null): string {
  const date = fmtDate(s);
  const time = fmtTime(s);
  return date && time ? `${date} · ${time}` : date;
}

/** yyyy-MM-dd for the user's local date. */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

/** Minutes since midnight from an ISO datetime string. */
export function minutesSinceMidnight(s: string): number {
  const d = new Date(s);
  return d.getHours() * 60 + d.getMinutes();
}

/** "HH:mm:ss" TimeSpan string to minutes since midnight. */
export function timeSpanToMinutes(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return parseInt(h) * 60 + parseInt(m);
}
