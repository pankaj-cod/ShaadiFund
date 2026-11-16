const longDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** "2027-02-14" -> "14 February 2027". Calendar dates have no time zone, so UTC is used throughout. */
export function formatCalendarDate(isoDate: string): string {
  return longDate.format(new Date(`${isoDate}T00:00:00Z`));
}

/** A moment in time, shown in Indian Standard Time: "15 Nov 2026, 7:13 pm". */
export function formatDateTime(value: string | Date): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value);
}

export function coupleNames(partnerOne: string | null, partnerTwo: string | null): string {
  const names = [partnerOne?.trim(), partnerTwo?.trim()].filter(Boolean);
  return names.length > 0 ? names.join(" & ") : "Your wedding";
}
